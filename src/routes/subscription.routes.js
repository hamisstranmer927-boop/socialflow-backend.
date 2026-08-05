const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const subscriptionService = require('../services/subscription.service');
const { stripe } = require('../config/stripe');

const router = express.Router();

/**
 * POST /api/subscriptions/create-checkout
 * Create Stripe checkout session
 */
router.post('/create-checkout', authenticate, async (req, res, next) => {
  try {
    const { tier } = req.body;
    if (!['starter', 'professional', 'enterprise'].includes(tier)) {
      return res.status(400).json({ success: false, error: 'Invalid tier.' });
    }

    const session = await subscriptionService.createCheckoutSession(req.userId, tier);
    res.json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/subscriptions/webhook
 * Handle Stripe webhooks (no auth required — verified by Stripe signature)
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    await subscriptionService.handleWebhookEvent(event);
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ error: 'Webhook processing failed.' });
  }
});

/**
 * GET /api/subscriptions/status
 * Get current subscription status
 */
router.get('/status', authenticate, async (req, res, next) => {
  try {
    const status = await subscriptionService.getSubscriptionStatus(req.userId);
    res.json({ success: true, data: status });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/subscriptions/cancel
 * Cancel subscription
 */
router.post('/cancel', authenticate, async (req, res, next) => {
  try {
    const result = await subscriptionService.cancelSubscription(req.userId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
