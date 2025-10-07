import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { connectDB } from './db/database.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { apiKeyMiddleware } from './middleware/apiKey.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import websiteRoutes from './routes/websites.js';
import privacyRoutes from './routes/privacy.js';
import validationRoutes from './routes/validation.js';
import billingRoutes from './routes/billing.js';
import eventsRoutes from './routes/eventsRoutes.js';
import supportRoutes from './routes/supportRoutes.js';
import webhookRoutes from './routes/webhooks.js';
import adminRoutes from './routes/admin.js';
import { config } from './config/config.js';

const app = express();

app.set('trust proxy', 1);

// Connect to database
connectDB();

// Security middleware
app.use(helmet());



// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan('combined'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'user-service'
  });
});

// Webhook routes (before API key middleware)
app.use('/api/v1/user/webhooks', webhookRoutes);

// API Key validation for all routes (except health check and webhooks)
app.use((req, res, next) => {
  // Skip API key validation for health check and webhooks
  if (req.path === '/health' || req.path.startsWith('/api/v1/user/webhooks')) {
    next();
    return;
  }
  // Apply API key middleware to all other routes
  apiKeyMiddleware(req, res, next);
});

// API routes
app.use('/api/v1/user/auth', authRoutes);
app.use('/api/v1/user/users', userRoutes);
app.use('/api/v1/user/websites', websiteRoutes);
app.use('/api/v1/user/privacy', privacyRoutes);
app.use('/api/v1/user/validation', validationRoutes);
app.use('/api/v1/user/billing', billingRoutes);
app.use('/api/v1/user/events', eventsRoutes);
app.use('/api/v1/user/support', supportRoutes);

// Admin API routes
app.use('/api/v1/admin', adminRoutes);

// Internal API routes for microservice communication
app.use('/api/internal', userRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

const PORT = config.PORT || 3001;
let server;

// Start server
server = app.listen(PORT, () => {
  console.log(`User Service running on port ${PORT}`);
});

// Graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`${signal} received, shutting down gracefully`);
  
  if (server) {
    server.close(() => {
      console.log('HTTP server closed');
    });
  }
  
  // Close database connections
  try {
    const mongoose = await import('mongoose');
    await mongoose.default.connection.close();
    console.log('MongoDB connection closed');
  } catch (error) {
    console.error('Error closing MongoDB connection:', error);
  }
  
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;