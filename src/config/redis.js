const Redis = require('ioredis');

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required for Bull
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

const redis = new Redis(redisConfig);

redis.on('connect', () => {
  console.log('✅ Redis connection established.');
});

redis.on('error', (err) => {
  console.error('❌ Redis connection error:', err.message);
});

/**
 * Create a new Redis connection for Bull queues
 * (Bull requires separate connections for client, subscriber, bclient)
 */
function createRedisConnection() {
  return new Redis(redisConfig);
}

module.exports = { redis, redisConfig, createRedisConnection };
