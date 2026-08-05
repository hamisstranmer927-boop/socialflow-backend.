const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { verifyFirebaseToken, getApp } = require('../config/firebase');
const { stripe } = require('../config/stripe');
const { ApiError } = require('../middleware/errorHandler');

/**
 * Register a new user (Firebase or email/password fallback)
 */
async function registerUser({ email, displayName, password, firebaseToken }) {
  // Check if user already exists
  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw new ApiError(409, 'A user with this email already exists.');
  }

  let firebaseUid = null;
  let passwordHash = null;

  // Firebase registration
  if (firebaseToken && getApp()) {
    const decoded = await verifyFirebaseToken(firebaseToken);
    firebaseUid = decoded.uid;
    email = decoded.email || email;
    displayName = displayName || decoded.name;
  } else if (password) {
    // Fallback: email/password
    passwordHash = await bcrypt.hash(password, 12);
  } else {
    throw new ApiError(400, 'Either a Firebase token or password is required.');
  }

  // Create Stripe customer
  let stripeCustomerId = null;
  try {
    const customer = await stripe.customers.create({
      email,
      name: displayName,
      metadata: { source: 'socialflow' },
    });
    stripeCustomerId = customer.id;
  } catch (stripeErr) {
    console.warn('⚠️  Stripe customer creation failed:', stripeErr.message);
    // Continue without Stripe in dev
  }

  // Create user
  const user = await User.create({
    email,
    displayName: displayName || email.split('@')[0],
    firebaseUid,
    passwordHash,
    subscriptionTier: 'starter',
    subscriptionStatus: 'active', // Free tier auto-active
    stripeCustomerId,
  });

  // Generate JWT
  const token = generateJWT(user);

  return {
    user: sanitizeUser(user),
    token,
  };
}

/**
 * Login user (Firebase or email/password)
 */
async function loginUser({ email, password, firebaseToken }) {
  let user;

  if (firebaseToken && getApp()) {
    // Firebase login
    const decoded = await verifyFirebaseToken(firebaseToken);
    user = await User.findOne({ where: { firebaseUid: decoded.uid } });

    if (!user) {
      // Auto-register Firebase users on first login
      return registerUser({ firebaseToken, email: decoded.email, displayName: decoded.name });
    }
  } else if (email && password) {
    // Email/password login
    user = await User.findOne({ where: { email } });
    if (!user || !user.passwordHash) {
      throw new ApiError(401, 'Invalid email or password.');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new ApiError(401, 'Invalid email or password.');
    }
  } else {
    throw new ApiError(400, 'Email/password or Firebase token required.');
  }

  if (!user.isActive) {
    throw new ApiError(403, 'Your account has been deactivated.');
  }

  // Update last login
  await user.update({ lastLoginAt: new Date() });

  const token = generateJWT(user);
  return {
    user: sanitizeUser(user),
    token,
  };
}

/**
 * Get user profile with connected accounts count
 */
async function getUserProfile(userId) {
  const user = await User.findByPk(userId, {
    include: [
      { association: 'socialAccounts', attributes: ['id', 'platform', 'accountName', 'accountUsername', 'avatarUrl', 'isActive'] },
    ],
  });

  if (!user) {
    throw new ApiError(404, 'User not found.');
  }

  return sanitizeUser(user);
}

/**
 * Update user profile
 */
async function updateProfile(userId, updates) {
  const user = await User.findByPk(userId);
  if (!user) throw new ApiError(404, 'User not found.');

  const allowedFields = ['displayName', 'avatarUrl', 'bio', 'jobTitle', 'company', 'phoneNumber'];
  const filteredUpdates = {};
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      filteredUpdates[field] = updates[field];
    }
  }

  await user.update(filteredUpdates);
  return sanitizeUser(user);
}

// ─── Helpers ─────────────────────────────────────────────

function generateJWT(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, tier: user.subscriptionTier },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function sanitizeUser(user) {
  const data = user.toJSON ? user.toJSON() : { ...user };
  delete data.passwordHash;
  delete data.firebaseUid;
  delete data.stripeCustomerId;
  delete data.stripeSubscriptionId;
  return data;
}

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  updateProfile,
  generateJWT,
};
