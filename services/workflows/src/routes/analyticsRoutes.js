import express from 'express';
import * as analyticsController from '../controllers/analyticsController.js';

const router = express.Router();

// Track workflow event (called by tracker.js)
router.post('/track', analyticsController.trackEvent);

// Track multiple workflow events in batch (called by tracker.js)
router.post('/track/batch', analyticsController.trackBatchEvents);

// Get workflow analytics
router.get('/workflow/:workflowId', analyticsController.getWorkflowAnalytics);

export default router;