import Queue from 'bull';
import { redisClient } from '../config/redis.js';
import * as executionService from './executionService.js';
import * as analyticsService from './analyticsService.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/config.js';

let workflowQueue;
let analyticsQueue;

export async function initializeQueues() {
  try {
    const workflowConcurrency = (config.queue && config.queue.workflowConcurrency) || 5;
    const analyticsConcurrency = (config.queue && config.queue.analyticsConcurrency) || 5;

    // Initialize workflow execution queue
    workflowQueue = new Queue('workflow execution', {
      redis: redisClient,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 1000,
        removeOnFail: 200,
        timeout: 60_000
      },
      limiter: {
        max: 200,
        duration: 1000
      }
    });

    // Initialize analytics queue
    analyticsQueue = new Queue('analytics processing', {
      redis: redisClient,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 500 },
        removeOnComplete: 2000,
        removeOnFail: 300,
        timeout: 30_000
      },
      limiter: {
        max: 500,
        duration: 1000
      }
    });

    // Process workflow execution jobs (with concurrency)
    workflowQueue.process('execute-action', workflowConcurrency, async (job) => {
      const { actionData } = job.data;
      return await executionService.executeWorkflowAction(actionData);
    });

    // Process analytics jobs (with concurrency)
    analyticsQueue.process('track-workflow-event', analyticsConcurrency, async (job) => {
      const { eventData } = job.data;
      return await analyticsService.trackWorkflowEvents(eventData);
    });

    // Queue event handlers
    workflowQueue.on('completed', (job) => {
      logger.debug(`Workflow job completed: ${job.id}`);
    });

    workflowQueue.on('failed', (job, err) => {
      logger.error(`Workflow job failed: ${job.id}`, err);
    });

    analyticsQueue.on('completed', (job) => {
      logger.debug(`Analytics job completed: ${job.id}`);
    });

    analyticsQueue.on('failed', (job, err) => {
      logger.error(`Analytics job failed: ${job.id}`, err);
    });

    logger.info('Queues initialized successfully');
    // DLQ removed - using direct logging for failed operations
  } catch (error) {
    logger.error('Failed to initialize queues:', error);
    throw error;
  }
}

export { workflowQueue, analyticsQueue };