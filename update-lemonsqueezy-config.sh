#!/bin/bash

echo "🍋 LemonSqueezy Configuration Setup"
echo "=================================="
echo ""
echo "You need to update your .env file with real LemonSqueezy credentials."
echo "The current values are placeholders and causing 401 Unauthorized errors."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Creating from .env.example..."
    cp .env.example .env
fi

echo "📋 Current LemonSqueezy configuration in .env:"
echo "=============================================="
grep -E "LEMON.*=" .env | head -10

echo ""
echo "🔧 To fix the 401 error, you need to:"
echo ""
echo "1. Go to LemonSqueezy Dashboard: https://app.lemonsqueezy.com/"
echo "2. Navigate to Settings → API"
echo "3. Create/copy your API Key"
echo "4. Get your Store ID from Settings → Stores"
echo "5. Get variant IDs from Products → Your Product → Variants"
echo ""
echo "6. Update your .env file with real values:"
echo ""
echo "   LEMONSQUEEZY_API_KEY=lsq_api_xxxxxxxxxxxxxxxx"
echo "   LEMONSQUEEZY_STORE_ID=12345"
echo "   LEMONSQUEEZY_STANDARD_VARIANT_ID=67890"
echo "   LEMONSQUEEZY_PRO_VARIANT_ID=54321"
echo "   LEMONSQUEEZY_WEBHOOK_SECRET=your_webhook_secret"
echo ""
echo "7. Restart your services:"
echo "   docker-compose down && docker-compose up -d"
echo ""

# Offer to open the .env file for editing
read -p "Would you like to edit the .env file now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ${EDITOR:-nano} .env
fi

echo ""
echo "🚀 After updating .env, restart services with:"
echo "   docker-compose down && docker-compose up -d"
