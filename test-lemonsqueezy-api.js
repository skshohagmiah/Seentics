#!/usr/bin/env node

/**
 * Test LemonSqueezy API Connection
 * Run this after updating your .env file to verify credentials
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const API_KEY = process.env.LEMONSQUEEZY_API_KEY;
const STORE_ID = process.env.LEMONSQUEEZY_STORE_ID;

console.log('🍋 Testing LemonSqueezy API Connection');
console.log('=====================================');
console.log('');

// Check if credentials are set
if (!API_KEY || API_KEY === 'your-lemon-squeezy-api-key') {
    console.log('❌ LEMONSQUEEZY_API_KEY is not set or using placeholder value');
    console.log('   Please update your .env file with real API key');
    process.exit(1);
}

if (!STORE_ID || STORE_ID === 'your-store-id') {
    console.log('❌ LEMONSQUEEZY_STORE_ID is not set or using placeholder value');
    console.log('   Please update your .env file with real store ID');
    process.exit(1);
}

console.log('✅ API Key found:', API_KEY.substring(0, 10) + '...');
console.log('✅ Store ID:', STORE_ID);
console.log('');

// Create API instance
const lemonSqueezyApi = axios.create({
    baseURL: 'https://api.lemonsqueezy.com/v1',
    headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${API_KEY}`
    }
});

async function testConnection() {
    try {
        console.log('🔍 Testing API connection...');
        
        // Test 1: Get user info
        const userResponse = await lemonSqueezyApi.get('/users/me');
        console.log('✅ API Connection successful!');
        console.log('   User:', userResponse.data.data.attributes.name);
        console.log('   Email:', userResponse.data.data.attributes.email);
        console.log('');

        // Test 2: Get store info
        console.log('🏪 Testing store access...');
        const storeResponse = await lemonSqueezyApi.get(`/stores/${STORE_ID}`);
        console.log('✅ Store access successful!');
        console.log('   Store:', storeResponse.data.data.attributes.name);
        console.log('   Domain:', storeResponse.data.data.attributes.domain);
        console.log('');

        // Test 3: Get products
        console.log('📦 Getting products...');
        const productsResponse = await lemonSqueezyApi.get(`/products?filter[store_id]=${STORE_ID}`);
        console.log('✅ Products found:', productsResponse.data.data.length);
        
        if (productsResponse.data.data.length > 0) {
            console.log('');
            console.log('📋 Available Products:');
            productsResponse.data.data.forEach((product, index) => {
                console.log(`   ${index + 1}. ${product.attributes.name} (ID: ${product.id})`);
            });
        }
        console.log('');

        // Test 4: Get variants
        console.log('🔧 Getting product variants...');
        const variantsResponse = await lemonSqueezyApi.get(`/variants?filter[product_id]=${productsResponse.data.data[0]?.id}`);
        
        if (variantsResponse.data.data.length > 0) {
            console.log('✅ Variants found:', variantsResponse.data.data.length);
            console.log('');
            console.log('📋 Available Variants:');
            variantsResponse.data.data.forEach((variant, index) => {
                console.log(`   ${index + 1}. ${variant.attributes.name} (ID: ${variant.id})`);
                console.log(`      Price: $${variant.attributes.price / 100}`);
            });
            
            console.log('');
            console.log('🔧 Update your .env file with these variant IDs:');
            console.log(`   LEMONSQUEEZY_STANDARD_VARIANT_ID=${variantsResponse.data.data[0]?.id || 'VARIANT_ID_HERE'}`);
            console.log(`   LEMONSQUEEZY_PRO_VARIANT_ID=${variantsResponse.data.data[1]?.id || 'VARIANT_ID_HERE'}`);
        }

        console.log('');
        console.log('🎉 All tests passed! Your LemonSqueezy integration is ready.');
        
    } catch (error) {
        console.error('❌ API Test failed:');
        console.error('   Status:', error.response?.status);
        console.error('   Message:', error.response?.data?.errors?.[0]?.detail || error.message);
        
        if (error.response?.status === 401) {
            console.log('');
            console.log('💡 Fix: Check your API key is correct and has proper permissions');
        } else if (error.response?.status === 404) {
            console.log('');
            console.log('💡 Fix: Check your store ID is correct');
        }
        
        process.exit(1);
    }
}

testConnection();
