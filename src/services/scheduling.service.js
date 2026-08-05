const Bull = require('bull');
const { Op } = require('sequelize');
const { ScheduledPost, PublishedPost, SocialAccount } = require('../models');
const { redisConfig } = require('../config/redis');
const { publishToplatform } = require('./social');
const { ApiError } = require('../middleware/errorHandler');

// Create Bull queue for post publishing
const postQueue = new Bull('post-publishing', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

/**
 * Schedule a new post
 */
async function createScheduledPost(userId, postData) {
  const { content, mediaUrls, platforms, targetAccountIds, scheduleTime, platformSpecific, tags, locationName } = postData;

  const post = await ScheduledPost.create({
    userId,
    content,
    mediaUrls: mediaUrls || [],
    targetAccountIds: targetAccountIds || [],
    platforms: platforms || [],
    scheduleTime: new Date(scheduleTime),
    status: 'scheduled',
    platformSpecific: platformSpecific || {},
    locationName: locationName || null,
    tags: tags || [],
  });

  // Add to Bull queue — delayed until schedule time
  const delay = new Date(scheduleTime).getTime() - Date.now();
  if (delay > 0) {
    const job = await postQueue.add(
      'publish',
      { postId: post.id, userId },
      { delay, jobId: `post-${post.id}` }
    );
    await post.update({ bullJobId: job.id.toString() });
  } else {
    // Schedule time is in the past or now — publish immediately
    const job = await postQueue.add(
      'publish',
      { postId: post.id, userId },
      { jobId: `post-${post.id}` }
    );
    await post.update({ bullJobId: job.id.toString() });
  }

  return post;
}

/**
 * Get all posts for a user (with filtering)
 */
async function getUserPosts(userId, filters = {}) {
  const where = { userId };

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.platform) {
    // JSON contains query for platforms array
    where.platforms = { [Op.contains]: [filters.platform] };
  }

  if (filters.from && filters.to) {
    where.scheduleTime = {
      [Op.between]: [new Date(filters.from), new Date(filters.to)],
    };
  }

  const posts = await ScheduledPost.findAll({
    where,
    attributes: ['id', 'content', 'mediaUrls', 'targetAccountIds', 'platforms', 'scheduleTime', 'status', 'publishedAt', 'tags', 'errorMessage', 'createdAt', 'locationName'],
    include: [
      {
        model: PublishedPost,
        as: 'publishedPosts',
        attributes: ['id', 'platform', 'platformPostId', 'postUrl', 'publishedAt', 'status'],
      },
    ],
    order: [['scheduleTime', 'ASC']],
    limit: filters.limit || 50,
    offset: filters.offset || 0,
  });

  return posts;
}

/**
 * Get a single post by ID
 */
async function getPostById(userId, postId) {
  const post = await ScheduledPost.findOne({
    where: { id: postId, userId },
    attributes: ['id', 'content', 'mediaUrls', 'targetAccountIds', 'platforms', 'scheduleTime', 'status', 'publishedAt', 'platformSpecific', 'tags', 'errorMessage', 'bullJobId', 'createdAt', 'updatedAt', 'locationName'],
    include: [{
      model: PublishedPost,
      as: 'publishedPosts',
      attributes: ['id', 'platform', 'platformPostId', 'postUrl', 'publishedAt', 'status', 'errorMessage'],
    }],
  });

  if (!post) throw new ApiError(404, 'Post not found.');
  return post;
}

/**
 * Update a scheduled post (only if still in draft/scheduled status)
 */
async function updatePost(userId, postId, updates) {
  const post = await ScheduledPost.findOne({
    where: { id: postId, userId },
  });

  if (!post) throw new ApiError(404, 'Post not found.');
  if (!['draft', 'scheduled'].includes(post.status)) {
    throw new ApiError(400, 'Cannot edit a post that has already been published or is publishing.');
  }

  const allowedFields = ['content', 'mediaUrls', 'targetAccountIds', 'platforms', 'scheduleTime', 'platformSpecific', 'tags', 'locationName'];
  const filteredUpdates = {};
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      filteredUpdates[field] = field === 'scheduleTime' ? new Date(updates[field]) : updates[field];
    }
  }

  await post.update(filteredUpdates);

  // Reschedule Bull job if schedule time changed
  if (updates.scheduleTime) {
    // Remove old job
    if (post.bullJobId) {
      const oldJob = await postQueue.getJob(post.bullJobId);
      if (oldJob) await oldJob.remove();
    }

    // Add new job
    const delay = new Date(updates.scheduleTime).getTime() - Date.now();
    const job = await postQueue.add(
      'publish',
      { postId: post.id, userId },
      { delay: Math.max(delay, 0), jobId: `post-${post.id}-${Date.now()}` }
    );
    await post.update({ bullJobId: job.id.toString() });
  }

  return post;
}

/**
 * Delete/cancel a scheduled post
 */
async function deletePost(userId, postId) {
  const post = await ScheduledPost.findOne({
    where: { id: postId, userId },
  });

  if (!post) throw new ApiError(404, 'Post not found.');

  // Remove from Bull queue
  if (post.bullJobId) {
    const job = await postQueue.getJob(post.bullJobId);
    if (job) await job.remove();
  }

  await post.destroy();
  return { message: 'Post deleted successfully.' };
}

/**
 * Publish a post immediately
 */
async function publishNow(userId, postId) {
  const post = await ScheduledPost.findOne({
    where: { id: postId, userId },
  });

  if (!post) throw new ApiError(404, 'Post not found.');
  if (post.status === 'published') {
    throw new ApiError(400, 'Post is already published.');
  }

  // Remove scheduled job
  if (post.bullJobId) {
    const job = await postQueue.getJob(post.bullJobId);
    if (job) await job.remove();
  }

  // Add immediate job
  await postQueue.add('publish', { postId: post.id, userId });
  await post.update({ status: 'publishing' });

  return { message: 'Post is being published now.' };
}

// ─── Bull Queue Processor ────────────────────────────────

postQueue.process('publish', async (job) => {
  const { postId, userId } = job.data;
  console.log(`📤 Publishing post: ${postId}`);

  const post = await ScheduledPost.findByPk(postId);
  if (!post || post.status === 'published') return;

  await post.update({ status: 'publishing' });

  const results = [];
  let hasFailure = false;
  let hasSuccess = false;

  // Get specific targeted connected accounts
  let targetAccountIds = post.targetAccountIds || [];
  
  // Backwards compatibility for older posts that only have platforms
  let accounts = [];
  if (targetAccountIds.length > 0) {
    accounts = await SocialAccount.findAll({
      where: { userId, id: targetAccountIds, isActive: true },
      attributes: ['id', 'platform', 'platformAccountId', 'accessToken', 'metadata'],
    });
  } else if (post.platforms && post.platforms.length > 0) {
    // Legacy fallback: grab one active account for each platform
    const allAccounts = await SocialAccount.findAll({
      where: { userId, isActive: true },
      attributes: ['id', 'platform', 'platformAccountId', 'accessToken', 'metadata'],
    });
    for (const p of post.platforms) {
      const acc = allAccounts.find(a => a.platform === p);
      if (acc) accounts.push(acc);
    }
  }

  // Publish to each target account
  for (const account of accounts) {
    const platform = account.platform;
    
    try {
      const publishData = {
        accessToken: account.accessToken,
        caption: post.content,
        message: post.content,
        imageUrl: post.mediaUrls?.[0],
        videoUrl: post.mediaUrls?.[0],
        locationName: post.locationName,
        igAccountId: account.platformAccountId,
        pageId: account.platformAccountId,
        metadata: account.metadata,
      };

      const result = await publishToplatform(platform, publishData);

      // Save published post record
      await PublishedPost.create({
        scheduledPostId: post.id,
        platform,
        platformPostId: result.platformPostId,
        postUrl: result.postUrl,
        publishedAt: new Date(),
        status: 'success',
        metadata: result,
      });

      results.push({ platform, status: 'success', ...result });
      hasSuccess = true;
    } catch (error) {
      console.error(`Failed to publish to ${platform}:`, error.message);

      await PublishedPost.create({
        scheduledPostId: post.id,
        platform,
        publishedAt: new Date(),
        status: 'failed',
        errorMessage: error.message,
      });

      results.push({ platform, status: 'failed', error: error.message });
      hasFailure = true;
    }
  }

  // Update post status
  let finalStatus = 'published';
  if (hasFailure && hasSuccess) finalStatus = 'partially_published';
  if (hasFailure && !hasSuccess) finalStatus = 'failed';

  await post.update({
    status: finalStatus,
    publishedAt: hasSuccess ? new Date() : null,
    errorMessage: hasFailure ? results.filter((r) => r.status === 'failed').map((r) => `${r.platform}: ${r.error}`).join('; ') : null,
  });

  console.log(`✅ Post ${postId} published: ${finalStatus}`);
  return results;
});

postQueue.on('failed', (job, err) => {
  console.error(`❌ Job ${job.id} failed:`, err.message);
});

module.exports = {
  createScheduledPost,
  getUserPosts,
  getPostById,
  updatePost,
  deletePost,
  publishNow,
  postQueue,
};
