const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2024-06-20',
});

/**
 * Subscription tier configuration
 */
const SUBSCRIPTION_TIERS = {
  starter: {
    name: 'Starter',
    priceId: process.env.STRIPE_PRICE_STARTER || 'price_starter',
    monthlyPrice: 9.99,
    maxAccounts: 2,
    maxPlatforms: 3,
    schedulingDays: 30,
    features: [
      'Up to 2 connected accounts',
      '30-day post scheduling',
      'Basic analytics',
      '3 platforms (Instagram, Facebook, TikTok)',
      'Mobile app access',
      'Email support',
    ],
  },
  professional: {
    name: 'Professional',
    priceId: process.env.STRIPE_PRICE_PROFESSIONAL || 'price_professional',
    monthlyPrice: 29.99,
    maxAccounts: 5,
    maxPlatforms: 6,
    schedulingDays: -1, // Unlimited
    features: [
      'Up to 5 connected accounts',
      'Unlimited post scheduling',
      'Advanced analytics',
      '6 platforms (+ LinkedIn, YouTube, X)',
      'Mobile + Web dashboard',
      'Ad account integration',
      'AI caption suggestions',
      'Team collaboration (3 members)',
      'Bulk scheduling (50 posts)',
      'Priority support',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    priceId: process.env.STRIPE_PRICE_ENTERPRISE || 'price_enterprise',
    monthlyPrice: 99.99,
    maxAccounts: -1, // Unlimited
    maxPlatforms: -1, // Unlimited
    schedulingDays: -1, // Unlimited
    features: [
      'Unlimited connected accounts',
      'All Professional features',
      'Unlimited team members',
      'Advanced trend intelligence',
      'Full campaign management',
      'Advanced ad management',
      'Custom reporting',
      'API access',
      'Dedicated account manager',
      'Phone support',
    ],
  },
};

/**
 * Get tier config by name
 * @param {string} tierName
 * @returns {object}
 */
function getTierConfig(tierName) {
  return SUBSCRIPTION_TIERS[tierName] || SUBSCRIPTION_TIERS.starter;
}

module.exports = { stripe, SUBSCRIPTION_TIERS, getTierConfig };
