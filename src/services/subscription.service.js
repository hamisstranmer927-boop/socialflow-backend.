const { stripe, SUBSCRIPTION_TIERS, getTierConfig } = require('../config/stripe');
const { User } = require('../models');
const { ApiError } = require('../middleware/errorHandler');

/**
 * Create a Stripe checkout session for subscription
 */
async function createCheckoutSession(userId, tierName) {
  const user = await User.findByPk(userId);
  if (!user) throw new ApiError(404, 'User not found.');

  const tierConfig = SUBSCRIPTION_TIERS[tierName];
  if (!tierConfig) throw new ApiError(400, `Invalid tier: ${tierName}`);

  // Ensure Stripe customer exists
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    try {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.displayName,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await user.update({ stripeCustomerId: customerId });
    } catch (err) {
      throw new ApiError(500, 'Failed to create payment customer.');
    }
  }

  // Create checkout session
  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: tierConfig.priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.CLIENT_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/subscription/cancel`,
      metadata: {
        userId: user.id,
        tier: tierName,
      },
    });

    return { sessionId: session.id, url: session.url };
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    throw new ApiError(500, 'Failed to create checkout session.');
  }
}

/**
 * Handle Stripe webhook events
 */
async function handleWebhookEvent(event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const tier = session.metadata?.tier;

      if (userId && tier) {
        await User.update(
          {
            subscriptionTier: tier,
            subscriptionStatus: 'active',
            stripeSubscriptionId: session.subscription,
          },
          { where: { id: userId } }
        );
        console.log(`✅ Subscription activated: ${userId} → ${tier}`);
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      const user = await User.findOne({
        where: { stripeSubscriptionId: subscription.id },
      });

      if (user) {
        const statusMap = {
          active: 'active',
          past_due: 'past_due',
          canceled: 'canceled',
          trialing: 'trialing',
          unpaid: 'past_due',
        };

        await user.update({
          subscriptionStatus: statusMap[subscription.status] || 'inactive',
        });
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const user = await User.findOne({
        where: { stripeSubscriptionId: subscription.id },
      });

      if (user) {
        await user.update({
          subscriptionTier: 'starter',
          subscriptionStatus: 'canceled',
          stripeSubscriptionId: null,
        });
        console.log(`⚠️  Subscription canceled: ${user.id}`);
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const user = await User.findOne({
        where: { stripeCustomerId: invoice.customer },
      });

      if (user) {
        await user.update({ subscriptionStatus: 'past_due' });
        console.log(`⚠️  Payment failed for user: ${user.id}`);
      }
      break;
    }

    default:
      console.log(`Unhandled Stripe event: ${event.type}`);
  }
}

/**
 * Get current subscription status
 */
async function getSubscriptionStatus(userId) {
  const user = await User.findByPk(userId);
  if (!user) throw new ApiError(404, 'User not found.');

  const tierConfig = getTierConfig(user.subscriptionTier);

  return {
    tier: user.subscriptionTier,
    tierName: tierConfig.name,
    status: user.subscriptionStatus,
    features: tierConfig.features,
    limits: {
      maxAccounts: tierConfig.maxAccounts,
      maxPlatforms: tierConfig.maxPlatforms,
      schedulingDays: tierConfig.schedulingDays,
    },
    monthlyPrice: tierConfig.monthlyPrice,
  };
}

/**
 * Cancel subscription
 */
async function cancelSubscription(userId) {
  const user = await User.findByPk(userId);
  if (!user) throw new ApiError(404, 'User not found.');

  if (!user.stripeSubscriptionId) {
    throw new ApiError(400, 'No active subscription to cancel.');
  }

  try {
    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    return { message: 'Subscription will be canceled at end of billing period.' };
  } catch (err) {
    console.error('Cancel subscription error:', err.message);
    throw new ApiError(500, 'Failed to cancel subscription.');
  }
}

module.exports = {
  createCheckoutSession,
  handleWebhookEvent,
  getSubscriptionStatus,
  cancelSubscription,
};
