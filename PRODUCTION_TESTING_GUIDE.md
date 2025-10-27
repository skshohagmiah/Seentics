# 🍋 LemonSqueezy Production Testing Guide

## 🎯 **Real Production Testing Steps**

### **Phase 1: Pre-Testing Setup**

#### 1. **Verify Environment Configuration**
```bash
# Check if all required environment variables are set
echo "LEMONSQUEEZY_API_KEY: ${LEMONSQUEEZY_API_KEY:+SET}"
echo "LEMONSQUEEZY_WEBHOOK_SECRET: ${LEMONSQUEEZY_WEBHOOK_SECRET:+SET}"
echo "LEMONSQUEEZY_STORE_ID: ${LEMONSQUEEZY_STORE_ID:+SET}"
echo "LEMONSQUEEZY_STANDARD_VARIANT_ID: ${LEMONSQUEEZY_STANDARD_VARIANT_ID:+SET}"
echo "LEMONSQUEEZY_PRO_VARIANT_ID: ${LEMONSQUEEZY_PRO_VARIANT_ID:+SET}"
echo "CLOUD_FEATURES_ENABLED: ${CLOUD_FEATURES_ENABLED}"
```

#### 2. **Set Up Real-Time Monitoring**
```bash
# Monitor webhook logs in real-time
docker logs -f seentics-user-service-1 | grep "🍋"

# Or if running locally
tail -f logs/user-service.log | grep "🍋"

# Monitor database changes
# Connect to MongoDB and watch subscription collection
mongosh "mongodb://seentics:seentics_mongo_pass@localhost:27017/seentics?authSource=admin"
```

#### 3. **Verify Webhook Endpoint Accessibility**
```bash
# Test webhook endpoint is accessible
curl -X POST http://your-domain.com/api/v1/user/webhooks/lemonsqueezy \
  -H "Content-Type: application/json" \
  -H "X-Signature: test" \
  -d '{"test": "connectivity"}'

# Should return 401 (signature validation failed) - this is expected
```

### **Phase 2: Real Subscription Testing**

#### **Step 1: Create Test User Account**
1. Register a new user account in your application
2. Note down the user ID from the database
3. Ensure the user has a free subscription created

#### **Step 2: Configure LemonSqueezy Webhook**
1. Go to LemonSqueezy Dashboard → Settings → Webhooks
2. Add webhook URL: `https://your-domain.com/api/v1/user/webhooks/lemonsqueezy`
3. Select events:
   - ✅ `subscription_created`
   - ✅ `subscription_updated`
   - ✅ `subscription_cancelled`
   - ✅ `subscription_payment_success`
   - ✅ `subscription_payment_failed`
4. Set webhook secret (same as `LEMONSQUEEZY_WEBHOOK_SECRET`)

#### **Step 3: Test Real Subscription Flow**

**🔴 IMPORTANT: Use LemonSqueezy Test Mode for initial testing**

1. **Start Monitoring**:
   ```bash
   # Terminal 1: Monitor webhook logs
   docker logs -f seentics-user-service-1 | grep "🍋"
   
   # Terminal 2: Monitor database
   mongosh "mongodb://seentics:seentics_mongo_pass@localhost:27017/seentics?authSource=admin"
   # Then run: db.subscriptions.watch()
   ```

2. **Initiate Subscription**:
   - Login to your test user account
   - Go to billing page
   - Click "Upgrade to Standard" or "Upgrade to Pro"
   - Complete the checkout process with test card: `4242 4242 4242 4242`

3. **Monitor the Flow**:
   Watch for these log entries in sequence:
   ```
   🍋 [webhook_xxx] Webhook received at [timestamp]
   🍋 [webhook_xxx] ✅ Webhook signature verified
   🍋 [webhook_xxx] Event: subscription_created
   🍋 [SUBSCRIPTION_CREATED] Processing subscription: [subscription_id]
   🍋 [SUBSCRIPTION_CREATED] ✅ User found: [user_email]
   🍋 [SUBSCRIPTION_CREATED] ✅ Plan mapped: standard/pro
   🍋 [SUBSCRIPTION_CREATED] ✅ Database updated
   🍋 [SUBSCRIPTION_CREATED] ✅ Subscription successfully created
   ```

### **Phase 3: Verification Checklist**

#### **✅ Database Verification**
```javascript
// Connect to MongoDB and verify subscription update
db.subscriptions.findOne({userId: ObjectId("YOUR_USER_ID")})

// Check these fields are updated:
// - plan: "standard" or "pro" (not "free")
// - status: "active"
// - lemonSqueezySubscriptionId: [subscription_id]
// - lemonSqueezyCustomerId: [customer_id]
// - lemonSqueezyVariantId: [variant_id]
// - currentPeriodStart: [date]
// - currentPeriodEnd: [date]
```

#### **✅ API Endpoint Verification**
```bash
# Test subscription API with user token
curl -X GET "http://localhost:8080/api/v1/user/billing/subscription" \
  -H "Authorization: Bearer YOUR_USER_JWT_TOKEN" \
  -H "X-API-Key: YOUR_GLOBAL_API_KEY"

# Should return updated subscription with new plan
```

#### **✅ Frontend Verification**
1. Refresh the billing page
2. Verify:
   - Current plan shows "Standard" or "Pro"
   - Usage limits are updated
   - "Upgrade" button is hidden or shows next tier
   - Billing date is displayed

#### **✅ Gateway Cache Verification**
```bash
# Check if gateway cache was invalidated
curl -X GET "http://localhost:8080/api/v1/user/profile" \
  -H "Authorization: Bearer YOUR_USER_JWT_TOKEN"

# User plan should be updated in response
```

### **Phase 4: Test Additional Scenarios**

#### **Test Subscription Cancellation**
1. Cancel subscription from LemonSqueezy dashboard
2. Monitor webhook: `subscription_cancelled`
3. Verify database: `status: "cancelled"`, `cancelAtPeriodEnd: true`

#### **Test Payment Success**
1. Wait for next billing cycle or trigger manual payment
2. Monitor webhook: `subscription_payment_success`
3. Verify invoice is added to subscription.invoices array

#### **Test Payment Failure**
1. Update payment method to failing card in LemonSqueezy
2. Monitor webhook: `subscription_payment_failed`
3. Verify database: `status: "past_due"`

### **Phase 5: Production Monitoring Setup**

#### **Set Up Persistent Logging**
```bash
# Add to your production logging setup
# Monitor webhook success rate
grep "🍋.*✅ Webhook processed successfully" /var/log/user-service.log | wc -l

# Monitor webhook failures
grep "🍋.*❌" /var/log/user-service.log

# Monitor subscription creations
grep "🍋.*SUBSCRIPTION_CREATED.*✅ Subscription successfully created" /var/log/user-service.log
```

#### **Set Up Alerts**
Create alerts for:
- Webhook signature validation failures
- Subscription creation failures
- Database update failures
- Gateway cache invalidation failures

### **🚨 Common Issues & Troubleshooting**

#### **Issue: Webhook Not Received**
- ✅ Check webhook URL is publicly accessible
- ✅ Verify webhook is configured in LemonSqueezy dashboard
- ✅ Check firewall/security group settings
- ✅ Verify SSL certificate is valid

#### **Issue: Signature Validation Failed**
- ✅ Verify `LEMONSQUEEZY_WEBHOOK_SECRET` matches LemonSqueezy setting
- ✅ Check webhook secret is not URL encoded
- ✅ Ensure raw body is used for signature verification

#### **Issue: User Not Found**
- ✅ Verify `user_id` is passed in checkout custom data
- ✅ Check user ID format (ObjectId vs string)
- ✅ Ensure user exists in database

#### **Issue: Plan Not Mapped**
- ✅ Verify `LEMONSQUEEZY_STANDARD_VARIANT_ID` and `LEMONSQUEEZY_PRO_VARIANT_ID`
- ✅ Check variant IDs match LemonSqueezy product variants
- ✅ Ensure environment variables are loaded correctly

### **📊 Success Metrics**

A successful test should show:
- ✅ Webhook received within 30 seconds of payment
- ✅ Signature validation passes
- ✅ User and subscription found in database
- ✅ Plan correctly mapped from variant ID
- ✅ Database updated with new subscription details
- ✅ Gateway cache invalidated
- ✅ Frontend reflects new subscription status
- ✅ API endpoints return updated subscription data

### **🎯 Final Production Checklist**

Before going live:
- [ ] Test with real payment (small amount)
- [ ] Verify webhook endpoint is HTTPS
- [ ] Test subscription cancellation flow
- [ ] Test payment failure handling
- [ ] Set up monitoring and alerts
- [ ] Document rollback procedures
- [ ] Test with multiple users simultaneously
- [ ] Verify email notifications (if implemented)
- [ ] Test edge cases (expired cards, etc.)
- [ ] Load test webhook endpoint
