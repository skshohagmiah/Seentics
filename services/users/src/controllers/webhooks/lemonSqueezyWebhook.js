import User from '../../models/User.js';
import Subscription, { SUBSCRIPTION_PLANS } from '../../models/Subscription.js';
import { verifyWebhookSignature } from '../../utils/lemonsqueezy.js';
import axios from 'axios';
import { config } from '../../config/config.js';

// Handle Lemon Squeezy webhooks
export const handleLemonSqueezyWebhook = async (req, res) => {
  const startTime = Date.now();
  const requestId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const signature = req.headers['x-signature'];
    const payload = JSON.stringify(req.body);
    
    console.log(`🍋 [${requestId}] Webhook received at ${new Date().toISOString()}`);
    console.log(`🍋 [${requestId}] Headers:`, {
      'x-signature': signature ? 'present' : 'missing',
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent']
    });
    
    // Verify webhook signature
    if (!verifyWebhookSignature(payload, signature, process.env.LEMONSQUEEZY_WEBHOOK_SECRET)) {
      console.error(`🍋 [${requestId}] ❌ Invalid webhook signature`);
      return res.status(401).json({
        success: false,
        message: 'Invalid webhook signature',
        requestId
      });
    }

    const { meta, data } = req.body;
    const eventName = meta.event_name;

    console.log(`🍋 [${requestId}] ✅ Webhook signature verified`);
    console.log(`🍋 [${requestId}] Event: ${eventName}`);
    console.log(`🍋 [${requestId}] Data ID: ${data?.id}`);
    console.log(`🍋 [${requestId}] Custom Data:`, meta.custom_data || data?.attributes?.custom_data);

    switch (eventName) {
      case 'subscription_created':
        await handleSubscriptionCreated(data);
        break;
      
      case 'subscription_updated':
        await handleSubscriptionUpdated(data);
        break;
      
      case 'subscription_cancelled':
        await handleSubscriptionCancelled(data);
        break;
      
      case 'subscription_resumed':
        await handleSubscriptionResumed(data);
        break;
      
      case 'subscription_expired':
        await handleSubscriptionExpired(data);
        break;
      
      case 'subscription_paused':
        await handleSubscriptionPaused(data);
        break;
      
      case 'subscription_unpaused':
        await handleSubscriptionUnpaused(data);
        break;
      
      case 'subscription_payment_failed':
        await handleSubscriptionPaymentFailed(data);
        break;
      
      case 'subscription_payment_success':
        await handleSubscriptionPaymentSuccess(data);
        break;
      
      case 'order_created':
        await handleOrderCreated(data);
        break;
      
      default:
        console.log(`🍋 [${requestId}] ⚠️ Unhandled webhook event: ${eventName}`);
    }

    const processingTime = Date.now() - startTime;
    console.log(`🍋 [${requestId}] ✅ Webhook processed successfully in ${processingTime}ms`);
    
    res.status(200).json({ 
      success: true, 
      requestId,
      processingTime: `${processingTime}ms`
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`🍋 [${requestId}] ❌ Webhook processing error (${processingTime}ms):`, error);
    console.error(`🍋 [${requestId}] Stack trace:`, error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed',
      error: error.message,
      requestId,
      processingTime: `${processingTime}ms`
    });
  }
};

// Handle subscription created
const handleSubscriptionCreated = async (data) => {
  const subscriptionId = data.id;
  console.log(`🍋 [SUBSCRIPTION_CREATED] Processing subscription: ${subscriptionId}`);
  
  try {
    const customUserId = data.attributes.custom_data?.user_id;
    console.log(`🍋 [SUBSCRIPTION_CREATED] Custom user ID: ${customUserId}`);
    console.log(`🍋 [SUBSCRIPTION_CREATED] Variant ID: ${data.attributes.variant_id}`);
    console.log(`🍋 [SUBSCRIPTION_CREATED] Customer ID: ${data.attributes.customer_id}`);
    
    if (!customUserId) {
      console.error(`🍋 [SUBSCRIPTION_CREATED] ❌ No user_id in subscription created webhook for subscription ${subscriptionId}`);
      return;
    }

    console.log(`🍋 [SUBSCRIPTION_CREATED] Looking up user: ${customUserId}`);
    const user = await User.findById(customUserId).populate('subscriptionId');
    if (!user) {
      console.error(`🍋 [SUBSCRIPTION_CREATED] ❌ User not found: ${customUserId}`);
      return;
    }

    console.log(`🍋 [SUBSCRIPTION_CREATED] ✅ User found: ${user.email}`);
    const subscription = user.subscriptionId;
    if (!subscription) {
      console.error(`🍋 [SUBSCRIPTION_CREATED] ❌ Subscription not found for user: ${customUserId}`);
      return;
    }

    console.log(`🍋 [SUBSCRIPTION_CREATED] ✅ Subscription found: ${subscription._id}`);

    // Map variant ID to plan
    const variantToPlan = {
      [process.env.LEMONSQUEEZY_STANDARD_VARIANT_ID]: SUBSCRIPTION_PLANS.STANDARD,
      [process.env.LEMONSQUEEZY_PRO_VARIANT_ID]: SUBSCRIPTION_PLANS.PRO
    };

    const plan = variantToPlan[data.attributes.variant_id];
    if (!plan) {
      console.error(`🍋 [SUBSCRIPTION_CREATED] ❌ Unknown variant ID: ${data.attributes.variant_id}`);
      console.error(`🍋 [SUBSCRIPTION_CREATED] Available variants:`, Object.keys(variantToPlan));
      return;
    }

    console.log(`🍋 [SUBSCRIPTION_CREATED] ✅ Plan mapped: ${plan}`);
    console.log(`🍋 [SUBSCRIPTION_CREATED] Updating subscription in database...`);

    // Store old values for comparison
    const oldPlan = subscription.plan;
    const oldStatus = subscription.status;

    // Update subscription
    subscription.plan = plan;
    subscription.status = 'active';
    subscription.lemonSqueezySubscriptionId = data.id;
    subscription.lemonSqueezyCustomerId = data.attributes.customer_id;
    subscription.lemonSqueezyVariantId = data.attributes.variant_id;
    subscription.currentPeriodStart = new Date(data.attributes.created_at);
    subscription.currentPeriodEnd = new Date(data.attributes.renews_at);
    subscription.cancelAtPeriodEnd = false;
    subscription.cancelledAt = null;

    await subscription.save();
    
    console.log(`🍋 [SUBSCRIPTION_CREATED] ✅ Database updated:`);
    console.log(`🍋 [SUBSCRIPTION_CREATED]   Plan: ${oldPlan} → ${plan}`);
    console.log(`🍋 [SUBSCRIPTION_CREATED]   Status: ${oldStatus} → active`);
    console.log(`🍋 [SUBSCRIPTION_CREATED]   Period: ${data.attributes.created_at} → ${data.attributes.renews_at}`);
    
    // Invalidate gateway cache for this user
    console.log(`🍋 [SUBSCRIPTION_CREATED] Invalidating gateway cache...`);
    await invalidateGatewayCache(customUserId);
    
    console.log(`🍋 [SUBSCRIPTION_CREATED] ✅ Subscription successfully created for user ${user.email} (${customUserId}): ${plan}`);
  } catch (error) {
    console.error(`🍋 [SUBSCRIPTION_CREATED] ❌ Error handling subscription created:`, error);
    console.error(`🍋 [SUBSCRIPTION_CREATED] Stack trace:`, error.stack);
  }
};

// Handle subscription updated
const handleSubscriptionUpdated = async (data) => {
  try {
    const subscription = await Subscription.findOne({
      lemonSqueezySubscriptionId: data.id
    });

    if (!subscription) {
      console.error(`Subscription not found: ${data.id}`);
      return;
    }

    // Update subscription details
    subscription.status = data.attributes.status;
    subscription.currentPeriodStart = new Date(data.attributes.created_at);
    subscription.currentPeriodEnd = new Date(data.attributes.renews_at);

    await subscription.save();
    
    // Invalidate gateway cache for this user
    const user = await User.findOne({ subscriptionId: subscription._id });
    if (user) {
      await invalidateGatewayCache(user._id.toString());
    }
    
    console.log(`Subscription updated: ${data.id}`);
  } catch (error) {
    console.error('Error handling subscription updated:', error);
  }
};

// Handle subscription cancelled
const handleSubscriptionCancelled = async (data) => {
  try {
    const subscription = await Subscription.findOne({
      lemonSqueezySubscriptionId: data.id
    });

    if (!subscription) {
      console.error(`Subscription not found: ${data.id}`);
      return;
    }

    subscription.status = 'cancelled';
    subscription.cancelAtPeriodEnd = true;
    subscription.cancelledAt = new Date(data.attributes.cancelled_at);

    await subscription.save();
    
    // Invalidate gateway cache for this user
    const user = await User.findOne({ subscriptionId: subscription._id });
    if (user) {
      await invalidateGatewayCache(user._id.toString());
    }
    
    console.log(`Subscription cancelled: ${data.id}`);
  } catch (error) {
    console.error('Error handling subscription cancelled:', error);
  }
};

// Handle subscription resumed
const handleSubscriptionResumed = async (data) => {
  try {
    const subscription = await Subscription.findOne({
      lemonSqueezySubscriptionId: data.id
    });

    if (!subscription) {
      console.error(`Subscription not found: ${data.id}`);
      return;
    }

    subscription.status = 'active';
    subscription.cancelAtPeriodEnd = false;
    subscription.cancelledAt = null;

    await subscription.save();
    
    // Invalidate gateway cache for this user
    const user = await User.findOne({ subscriptionId: subscription._id });
    if (user) {
      await invalidateGatewayCache(user._id.toString());
    }
    
    console.log(`Subscription resumed: ${data.id}`);
  } catch (error) {
    console.error('Error handling subscription resumed:', error);
  }
};

// Handle subscription expired
const handleSubscriptionExpired = async (data) => {
  try {
    const subscription = await Subscription.findOne({
      lemonSqueezySubscriptionId: data.id
    });

    if (!subscription) {
      console.error(`Subscription not found: ${data.id}`);
      return;
    }

    // Downgrade to free plan
    subscription.plan = SUBSCRIPTION_PLANS.FREE;
    subscription.status = 'expired';
    subscription.lemonSqueezySubscriptionId = null;
    subscription.lemonSqueezyVariantId = null;
    subscription.currentPeriodEnd = null;

    await subscription.save();
    
    // Invalidate gateway cache for this user
    const user = await User.findOne({ subscriptionId: subscription._id });
    if (user) {
      await invalidateGatewayCache(user._id.toString());
    }
    
    console.log(`Subscription expired, downgraded to free: ${data.id}`);
  } catch (error) {
    console.error('Error handling subscription expired:', error);
  }
};

// Handle subscription paused
const handleSubscriptionPaused = async (data) => {
  try {
    const subscription = await Subscription.findOne({
      lemonSqueezySubscriptionId: data.id
    });

    if (!subscription) {
      console.error(`Subscription not found: ${data.id}`);
      return;
    }

    subscription.status = 'paused';
    await subscription.save();
    
    // Invalidate gateway cache for this user
    const user = await User.findOne({ subscriptionId: subscription._id });
    if (user) {
      await invalidateGatewayCache(user._id.toString());
    }
    
    console.log(`Subscription paused: ${data.id}`);
  } catch (error) {
    console.error('Error handling subscription paused:', error);
  }
};

// Handle subscription unpaused
const handleSubscriptionUnpaused = async (data) => {
  try {
    const subscription = await Subscription.findOne({
      lemonSqueezySubscriptionId: data.id
    });

    if (!subscription) {
      console.error(`Subscription not found: ${data.id}`);
      return;
    }

    subscription.status = 'active';
    await subscription.save();
    
    // Invalidate gateway cache for this user
    const user = await User.findOne({ subscriptionId: subscription._id });
    if (user) {
      await invalidateGatewayCache(user._id.toString());
    }
    
    console.log(`Subscription unpaused: ${data.id}`);
  } catch (error) {
    console.error('Error handling subscription unpaused:', error);
  }
};

// Handle subscription payment failed
const handleSubscriptionPaymentFailed = async (data) => {
  try {
    const subscription = await Subscription.findOne({
      lemonSqueezySubscriptionId: data.id
    });

    if (!subscription) {
      console.error(`Subscription not found: ${data.id}`);
      return;
    }

    subscription.status = 'past_due';
    await subscription.save();
    
    // Invalidate gateway cache for this user
    const user = await User.findOne({ subscriptionId: subscription._id });
    if (user) {
      await invalidateGatewayCache(user._id.toString());
    }
    
    console.log(`Subscription payment failed: ${data.id}`);
  } catch (error) {
    console.error('Error handling subscription payment failed:', error);
  }
};

// Handle subscription payment success
const handleSubscriptionPaymentSuccess = async (data) => {
  try {
    const subscription = await Subscription.findOne({
      lemonSqueezySubscriptionId: data.id
    });

    if (!subscription) {
      console.error(`Subscription not found: ${data.id}`);
      return;
    }

    subscription.status = 'active';
    
    // Add invoice to history
    subscription.invoices.push({
      lemonSqueezyInvoiceId: data.attributes.invoice_id,
      amount: data.attributes.total,
      currency: data.attributes.currency,
      status: 'paid',
      paidAt: new Date()
    });

    await subscription.save();
    
    // Invalidate gateway cache for this user
    const user = await User.findOne({ subscriptionId: subscription._id });
    if (user) {
      await invalidateGatewayCache(user._id.toString());
    }
    
    console.log(`Subscription payment successful: ${data.id}`);
  } catch (error) {
    console.error('Error handling subscription payment success:', error);
  }
};

// Handle order created (one-time purchases)
const handleOrderCreated = async (data) => {
  try {
    console.log(`Order created: ${data.id}`);
    // Handle one-time purchases if needed
  } catch (error) {
    console.error('Error handling order created:', error);
  }
};

// Helper function to invalidate gateway cache
const invalidateGatewayCache = async (userId) => {
  try {
    const gatewayUrl = process.env.GATEWAY_URL || 'http://localhost:8080';
    
    // Call gateway cache invalidation endpoint
    await axios.delete(`${gatewayUrl}/api/v1/cache/user/${userId}`, {
      headers: {
        'X-API-Key': config.globalApiKey
      },
      timeout: 5000 // 5 second timeout
    });
    
    console.log(`Gateway cache invalidated for user: ${userId}`);
  } catch (error) {
    // Don't fail the webhook if cache invalidation fails
    console.warn(`Failed to invalidate gateway cache for user ${userId}:`, error.message);
  }
};
