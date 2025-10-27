import User from '../../models/User.js';
import Subscription, { SUBSCRIPTION_PLANS } from '../../models/Subscription.js';
import { lemonSqueezyApiInstance } from '../../utils/lemonsqueezy.js';

// Check if cloud features are enabled
const isCloudFeaturesEnabled = () => {
  return process.env.CLOUD_FEATURES_ENABLED === 'true';
};

// Middleware to check if billing features are enabled
export const requireCloudFeatures = (req, res, next) => {
  if (!isCloudFeaturesEnabled()) {
    return res.status(404).json({
      success: false,
      message: 'Billing features are not available in open source deployment'
    });
  }
  next();
};

// Get user's current subscription
export const getSubscription = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('subscriptionId');
    
    if (!user || !user.subscriptionId) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    const subscription = user.subscriptionId;
    const planLimits = subscription.getPlanLimits();

    res.json({
      success: true,
      data: {
        subscription: {
          ...subscription.toJSON(),
          limits: planLimits,
          isActive: subscription.isActive()
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get subscription',
      error: error.message
    });
  }
};

// Create checkout session for subscription upgrade
export const createCheckoutSession = async (req, res) => {
  try {
    const { plan } = req.body;
    const userId = req.user.id;

    // Validate plan
    if (!Object.values(SUBSCRIPTION_PLANS).includes(plan)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription plan'
      });
    }

    // Don't allow checkout for free plan
    if (plan === SUBSCRIPTION_PLANS.FREE) {
      return res.status(400).json({
        success: false,
        message: 'Free plan does not require checkout'
      });
    }

    const user = await User.findById(userId).populate('subscriptionId');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get variant ID based on plan (these should be configured in your Lemon Squeezy dashboard)
    const variantIds = {
      [SUBSCRIPTION_PLANS.STANDARD]: process.env.LEMONSQUEEZY_STANDARD_VARIANT_ID,
      [SUBSCRIPTION_PLANS.PRO]: process.env.LEMONSQUEEZY_PRO_VARIANT_ID
    };

    const variantId = variantIds[plan];
    if (!variantId) {
      return res.status(400).json({
        success: false,
        message: 'Plan variant not configured'
      });
    }

    // Create checkout session
    const checkoutData = {
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: {
            email: user.email,
            name: user.name,
            custom: {
              user_id: userId
            }
          }
        },
        relationships: {
          store: {
            data: {
              type: 'stores',
              id: process.env.LEMONSQUEEZY_STORE_ID
            }
          },
          variant: {
            data: {
              type: 'variants',
              id: variantId
            }
          }
        }
      }
    };

    const response = await lemonSqueezyApiInstance.post('/checkouts', checkoutData);
    
    console.log(`✅ Checkout session created for user ${user.email}: ${plan}`);
    console.log(`🔗 Checkout URL: ${response.data.data.attributes.url}`);
    
    res.json({
      success: true,
      data: {
        checkoutUrl: response.data.data.attributes.url
      }
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    console.error('LemonSqueezy API Error:', error.response?.data);
    res.status(500).json({
      success: false,
      message: 'Failed to create checkout session',
      error: error.message
    });
  }
};

// Cancel subscription
export const cancelSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).populate('subscriptionId');
    
    if (!user || !user.subscriptionId) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    const subscription = user.subscriptionId;

    // If it's a free plan, can't cancel
    if (subscription.plan === SUBSCRIPTION_PLANS.FREE) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel free plan'
      });
    }

    // Cancel at Lemon Squeezy if there's a subscription ID
    if (subscription.lemonSqueezySubscriptionId) {
      try {
        await lemonSqueezyApiInstance.delete(`/subscriptions/${subscription.lemonSqueezySubscriptionId}`);
      } catch (error) {
        console.error('Lemon Squeezy cancellation error:', error);
        // Continue with local cancellation even if remote fails
      }
    }

    // Update subscription locally
    subscription.cancelAtPeriodEnd = true;
    subscription.cancelledAt = new Date();
    subscription.cancellationReason = req.body.reason || 'User requested cancellation';
    await subscription.save();

    res.json({
      success: true,
      message: 'Subscription cancelled successfully',
      data: {
        subscription: subscription.toJSON()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription',
      error: error.message
    });
  }
};

// Get billing history
export const getBillingHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).populate('subscriptionId');
    
    if (!user || !user.subscriptionId) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    const subscription = user.subscriptionId;
    
    res.json({
      success: true,
      data: {
        invoices: subscription.invoices || []
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get billing history',
      error: error.message
    });
  }
};

// Check usage limits
export const checkUsageLimits = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).populate('subscriptionId');
    
    if (!user || !user.subscriptionId) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    const subscription = user.subscriptionId;
    const limits = subscription.getPlanLimits();

    // Count actual resources instead of relying on potentially outdated counters
    const Website = (await import('../../models/Website.js')).default;
    const userWebsites = await Website.find({ 
      userId: userId, 
      isActive: true 
    });
    const actualWebsiteCount = userWebsites.length;

    // Count workflows and funnels by making API calls to respective services
    let actualWorkflowCount = 0;
    let actualFunnelCount = 0;

    // Count workflows across all user's websites
    for (const website of userWebsites) {
      try {
        const axios = (await import('axios')).default;
        const { config } = await import('../../config/config.js');
        
        const workflowsResponse = await axios.get(`http://workflows-service:3003/api/v1/workflows?siteId=${website._id}`, {
          headers: {
            'X-API-Key': config.globalApiKey,
            'x-user-id': user._id.toString(),
            'x-user-email': user.email,
            'x-user-name': user.name || '',
            'x-user-plan': user.plan || 'free',
            'x-user-status': user.status || 'active'
          },
          timeout: 5000
        });
        
        console.log(`Workflows response for site ${website._id}:`, workflowsResponse.data);
        
        if (workflowsResponse.data && Array.isArray(workflowsResponse.data)) {
          actualWorkflowCount += workflowsResponse.data.length || 0;
        } else if (workflowsResponse.data.success && workflowsResponse.data.data) {
          actualWorkflowCount += workflowsResponse.data.data.length || 0;
        }
      } catch (error) {
        console.error(`Failed to get workflow count for site ${website._id}:`, error.message);
        if (error.response) {
          console.error('Response status:', error.response.status);
          console.error('Response data:', error.response.data);
        }
      }
    }

    // Count funnels across all user's websites (funnels are in analytics service)
    for (const website of userWebsites) {
      try {
        const axios = (await import('axios')).default;
        const { config } = await import('../../config/config.js');
        
        const funnelsResponse = await axios.get(`http://analytics-service:3002/api/v1/funnels?website_id=${website._id}`, {
          headers: {
            'X-API-Key': config.globalApiKey,
            'x-user-id': user._id.toString(),
            'x-user-email': user.email,
            'x-user-name': user.name || '',
            'x-user-plan': user.plan || 'free',
            'x-user-status': user.status || 'active'
          },
          timeout: 5000
        });
        
        console.log(`Funnels response for site ${website._id}:`, funnelsResponse.data);
        
        if (funnelsResponse.data.success && funnelsResponse.data.data) {
          actualFunnelCount += funnelsResponse.data.data.length || 0;
        } else if (funnelsResponse.data && Array.isArray(funnelsResponse.data)) {
          actualFunnelCount += funnelsResponse.data.length || 0;
        }
      } catch (error) {
        console.error(`Failed to get funnel count for site ${website._id}:`, error.message);
        if (error.response) {
          console.error('Response status:', error.response.status);
          console.error('Response data:', error.response.data);
        }
      }
    }

    // Update subscription counters with actual counts
    subscription.currentUsage.websites = actualWebsiteCount;
    subscription.currentUsage.workflows = actualWorkflowCount;
    subscription.currentUsage.funnels = actualFunnelCount;
    await subscription.save();

    const usageStatus = {
      websites: {
        current: actualWebsiteCount,
        limit: limits.websites,
        canCreate: actualWebsiteCount < limits.websites
      },
      workflows: {
        current: actualWorkflowCount,
        limit: limits.workflows,
        canCreate: actualWorkflowCount < limits.workflows
      },
      funnels: {
        current: actualFunnelCount,
        limit: limits.funnels,
        canCreate: actualFunnelCount < limits.funnels
      },
      monthlyEvents: {
        current: subscription.currentUsage.monthlyEvents,
        limit: limits.monthlyEvents,
        canTrack: subscription.canTrackEvents()
      }
    };

    res.json({
      success: true,
      data: {
        plan: subscription.plan,
        usage: usageStatus,
        features: limits.features
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to check usage limits',
      error: error.message
    });
  }
};

// Increment usage counter
export const incrementUsage = async (req, res) => {
  try {
    const { type, count = 1 } = req.body;
    const userId = req.user.id;

    if (!type || !['websites', 'workflows', 'funnels', 'monthlyEvents'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid usage type'
      });
    }

    const user = await User.findById(userId).populate('subscriptionId');
    
    if (!user || !user.subscriptionId) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    const subscription = user.subscriptionId;
    subscription.incrementUsage(type, count);
    await subscription.save();

    res.json({
      success: true,
      message: 'Usage updated successfully',
      data: {
        type,
        count,
        newUsage: subscription.currentUsage[type]
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to increment usage',
      error: error.message
    });
  }
};
