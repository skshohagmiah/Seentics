import dotenv from 'dotenv';

dotenv.config();

// Validate required environment variables in production
function validateEnvironment() {
  const required = ['MONGODB_URI', 'JWT_SECRET', 'GLOBAL_API_KEY'];
  const missing = required.filter(key => !process.env[key]);
  
  if (process.env.NODE_ENV === 'production' && missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

validateEnvironment();

export const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.USER_SERVICE_PORT || process.env.PORT || 3001,
  MONGODB_URI: process.env.USER_MONGODB_URI || process.env.MONGODB_URI || 'mongodb://mongodb:27017/seentics_users',
  
  // JWT Configuration
  JWT_SECRET: process.env.USER_JWT_SECRET || process.env.JWT_SECRET,
  JWT_EXPIRE: process.env.JWT_EXPIRE || '7d',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRE: process.env.JWT_REFRESH_EXPIRE || '30d',
  
  // OAuth Configuration
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  
  // Frontend URLs
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  
  // Lemon Squeezy Configuration  
  LEMON_SQUEEZY_API_KEY: process.env.LEMON_SQUEEZY_API_KEY,
  LEMON_SQUEEZY_WEBHOOK_SECRET: process.env.LEMON_SQUEEZY_WEBHOOK_SECRET,
  LEMON_SQUEEZY_STORE_ID: process.env.LEMON_SQUEEZY_STORE_ID,
  
  // Service Configuration
  SERVICE_NAME: 'user-service',
  API_VERSION: 'v1',
  
  // Global API Key for inter-service communication
  globalApiKey: process.env.GLOBAL_API_KEY,
  
  // Gateway URL for cache invalidation
  gatewayUrl: process.env.GATEWAY_URL || 'http://localhost:8080',
};