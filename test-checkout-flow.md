# 🧪 Testing the Fixed Checkout Flow

## **What We Fixed**

1. **❌ Before**: Hard-coded checkout URLs that didn't specify which plan to purchase
2. **✅ After**: Dynamic checkout session creation through your billing API

## **How It Works Now**

### **Step 1: User Clicks Upgrade**
- Frontend calls `/api/v1/user/billing/checkout` with the selected plan
- Backend creates a proper LemonSqueezy checkout session with:
  - Correct variant ID for the selected plan
  - User's email and ID in custom data
  - Your store configuration

### **Step 2: Checkout Session Created**
- LemonSqueezy returns a unique checkout URL
- User is redirected to the proper checkout page
- Checkout page has user's email pre-filled

### **Step 3: Payment Completion**
- User completes payment on LemonSqueezy
- LemonSqueezy sends webhook to your server
- Your webhook handler processes the subscription creation
- Database is updated with new subscription details

## **Testing Steps**

### **1. Test Environment Setup**
```bash
# Make sure these environment variables are set:
echo "LEMONSQUEEZY_API_KEY: ${LEMONSQUEEZY_API_KEY:+SET}"
echo "LEMONSQUEEZY_STORE_ID: ${LEMONSQUEEZY_STORE_ID:+SET}"
echo "LEMONSQUEEZY_STANDARD_VARIANT_ID: ${LEMONSQUEEZY_STANDARD_VARIANT_ID:+SET}"
echo "LEMONSQUEEZY_PRO_VARIANT_ID: ${LEMONSQUEEZY_PRO_VARIANT_ID:+SET}"
echo "CLOUD_FEATURES_ENABLED: ${CLOUD_FEATURES_ENABLED}"
```

### **2. Test Checkout Creation**
1. **Login to your application**
2. **Go to billing page**: `/websites/[websiteId]/billing`
3. **Click "Upgrade" button**
4. **Check browser console** for any errors
5. **Verify checkout URL** opens in new tab

### **3. Monitor the Process**
```bash
# Terminal 1: Watch user service logs
docker logs -f seentics-user-service-1 | grep -E "(✅|❌|🍋)"

# Terminal 2: Watch for checkout creation
docker logs -f seentics-user-service-1 | grep "Checkout session created"
```

### **4. Expected Log Output**
When you click upgrade, you should see:
```
✅ Checkout session created for user your-email@example.com: standard
🔗 Checkout URL: https://seentics.lemonsqueezy.com/checkout/...
```

### **5. Complete Test Purchase**
1. **Use test mode** in LemonSqueezy
2. **Test card**: `4242 4242 4242 4242`
3. **Complete checkout**
4. **Watch for webhook logs**:
```
🍋 [webhook_xxx] Webhook received at [timestamp]
🍋 [webhook_xxx] ✅ Webhook signature verified
🍋 [webhook_xxx] Event: subscription_created
🍋 [SUBSCRIPTION_CREATED] ✅ Subscription successfully created
```

## **Troubleshooting**

### **Issue: "Failed to create checkout session"**
- ✅ Check LemonSqueezy API key is valid
- ✅ Verify store ID and variant IDs are correct
- ✅ Check user service logs for detailed error

### **Issue: Checkout URL doesn't open**
- ✅ Check browser popup blocker
- ✅ Verify API response contains valid URL
- ✅ Check network tab for API call errors

### **Issue: Webhook not received after payment**
- ✅ Verify webhook URL is publicly accessible
- ✅ Check LemonSqueezy webhook configuration
- ✅ Ensure webhook secret matches environment variable

## **Verification Checklist**

After successful test:
- [ ] Checkout session creates successfully
- [ ] LemonSqueezy checkout page opens with pre-filled email
- [ ] Payment completes successfully
- [ ] Webhook is received and processed
- [ ] Database subscription is updated
- [ ] Frontend billing page reflects new plan
- [ ] User gains access to premium features

## **Next Steps**

Once testing is successful:
1. **Switch to live mode** in LemonSqueezy
2. **Update webhook URL** to production domain
3. **Test with real payment** (small amount)
4. **Set up monitoring** for production webhooks
5. **Document the process** for your team
