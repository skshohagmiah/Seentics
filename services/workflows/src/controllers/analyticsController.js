import * as analyticsService from '../services/analyticsService.js';
import { logger } from '../utils/logger.js';

// Track single workflow event
export const trackEvent = async (req, res, next) => {
  try {
    const eventData = req.body;
    await analyticsService.trackWorkflowEvents(eventData);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// Track multiple workflow events in batch
export const trackBatchEvents = async (req, res, next) => {
  try {
    const { events } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'Events array is required' });
    }

    await analyticsService.trackWorkflowEvents(events);
    res.json({ success: true, processed: events.length });
  } catch (error) {
    next(error);
  }
};


// Get workflow analytics
export const getWorkflowAnalytics = async (req, res, next) => {
  try {
    setNoCacheHeaders(res);

    const { startDate, endDate } = req.query;
    const analytics = await analyticsService.getWorkflowAnalytics(req.params.workflowId, {
      startDate,
      endDate
    });

    res.json(analytics);
  } catch (error) {
    next(error);
  }
};

// Helper method to set no-cache headers
const setNoCacheHeaders = (res) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
};