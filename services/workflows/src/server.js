import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config/config.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/authMiddleware.js';
import { apiKeyMiddleware } from './middleware/apiKeyMiddleware.js';
import { initializeMongoDB } from './config/mongodb.js';
import { initializeRedis } from './config/redis.js';
import { initializeQueues } from './services/queueService.js';
import aggregationService from './services/aggregationService.js';

// Route imports
import workflowRoutes from './routes/workflowRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import visitorRoutes from './routes/visitorRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import adminRoutes from './routes/admin.js';

const app = express();
let server;

// Security middleware
app.use(helmet());

// Disable ETags to prevent 304 responses
app.set('etag', false);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// Logging middleware
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Health check route (no auth required)
app.use('/health', healthRoutes);

// API Key validation for all routes (except health check)
app.use((req, res, next) => {
  // Skip API key validation for health check
  if (req.path === '/health') {
    next();
    return;
  }
  // Apply API key middleware to all other routes
  apiKeyMiddleware(req, res, next);
});

// Auth middleware for protected routes
app.use('/api', authMiddleware);

// API routes
app.use('/api/v1/workflows', workflowRoutes);
app.use('/api/v1/workflows/analytics', analyticsRoutes);
app.use('/api/v1/visitor', visitorRoutes);

// Admin API routes
app.use('/api/v1/admin', adminRoutes);


// Error handling middleware
app.use(errorHandler);

// Initialize services
async function initializeServices() {
  try {
    await initializeMongoDB();
    await initializeRedis();
    await initializeQueues();
    
    // Start aggregation service cron jobs
    aggregationService.start();

    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

// Start server
async function startServer() {
  await initializeServices();
  
  const PORT = config.port || 3003;
  server = app.listen(PORT, () => {
    logger.info(`Workflows Service running on port ${PORT}`);
    logger.info(`Environment: ${config.env}`);
  });
}

// Graceful shutdown
async function gracefulShutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully`);
  
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
    });
  }
  
  // Close database connections
  try {
    const mongoose = await import('mongoose');
    await mongoose.default.connection.close();
    logger.info('MongoDB connection closed');
  } catch (error) {
    logger.error('Error closing MongoDB connection:', error);
  }
  
  // Close Redis connections
  try {
    const { redisClient } = await import('./config/redis.js');
    if (redisClient) {
      redisClient.disconnect();
      logger.info('Redis connection closed');
    }
  } catch (error) {
    logger.error('Error closing Redis connection:', error);
  }
  
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer().catch(error => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

export default app;