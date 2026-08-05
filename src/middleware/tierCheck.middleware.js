const { getTierConfig } = require('../config/stripe');
const { SocialAccount } = require('../models');

/**
 * Middleware to check subscription tier permissions.
 * Use as: tierCheck('featureName') or tierCheck({ minTier: 'professional' })
 */
function tierCheck(options = {}) {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required.',
        });
      }

      const tierConfig = getTierConfig(user.subscriptionTier);

      // Check minimum tier requirement
      if (options.minTier) {
        const tierOrder = { starter: 1, professional: 2, enterprise: 3 };
        const userTierLevel = tierOrder[user.subscriptionTier] || 0;
        const requiredLevel = tierOrder[options.minTier] || 0;

        if (userTierLevel < requiredLevel) {
          return res.status(403).json({
            success: false,
            error: `This feature requires a ${options.minTier} plan or higher.`,
            requiredTier: options.minTier,
            currentTier: user.subscriptionTier,
          });
        }
      }

      // Check connected accounts limit
      if (options.checkAccountLimit) {
        const accountCount = await SocialAccount.count({
          where: { userId: user.id, isActive: true },
        });

        if (tierConfig.maxAccounts !== -1 && accountCount >= tierConfig.maxAccounts) {
          return res.status(403).json({
            success: false,
            error: `Your ${tierConfig.name} plan allows up to ${tierConfig.maxAccounts} connected accounts. Please upgrade to add more.`,
            limit: tierConfig.maxAccounts,
            current: accountCount,
          });
        }
      }

      // Attach tier config to request for use in controllers
      req.tierConfig = tierConfig;
      next();
    } catch (error) {
      console.error('Tier check error:', error);
      next(error);
    }
  };
}

module.exports = { tierCheck };
