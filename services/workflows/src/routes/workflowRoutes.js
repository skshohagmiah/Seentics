import express from 'express';
import * as executionController from '../controllers/executionController.js';
import * as workflowController from '../controllers/workflowController.js';
import * as workflowStatsController from '../controllers/workflowStatsController.js';
import { checkSubscriptionLimit, incrementUsageCounter } from '../middleware/subscriptionMiddleware.js';

const router = express.Router();

// Workflow CRUD operations
router.post('/', checkSubscriptionLimit('workflows'), incrementUsageCounter('workflows'), workflowController.create);
router.get('/', workflowController.getAll);
router.get('/:id', workflowController.getById);
router.put('/:id', workflowController.update);
router.patch('/:id/status', workflowController.updateStatus);
router.delete('/:id', workflowController.deleteWorkflow);

// Public endpoints for tracker
router.get('/active', workflowController.getActiveByQuery);
router.get('/site/:siteId/active', workflowController.getActiveBySite);

// Execution endpoints (public with validation)
router.post('/execution/action', executionController.executeAction);


// New aggregated stats endpoints
router.get('/:id/stats', workflowStatsController.getWorkflowStats);
router.get('/:id/stats/nodes', workflowStatsController.getNodePerformance);
router.get('/stats/summary', workflowStatsController.getWorkflowSummary);
router.post('/:id/stats/reset', workflowStatsController.resetWorkflowStats);

export default router;