import Workflow from '../models/Workflow.js';
import { logger } from '../utils/logger.js';

// Normalize event data from different formats (simplified - only essential fields)
const normalizeEventData = (eventData) => {
  if (eventData.event_type === 'workflow_analytics') {
    return {
      workflowId: eventData.workflow_id,
      nodeId: eventData.node_id,
      event: eventData.analytics_event_type,
      result: eventData.result,
      timestamp: new Date(eventData.timestamp || Date.now())
    };
  } else if (eventData.t === 'wf') {
    // Handle optimized workflow tracking payload
    return {
      workflowId: eventData.wf,
      nodeId: eventData.n,
      event: eventData.e,
      result: eventData.r,
      timestamp: new Date(eventData.ts || Date.now())
    };
  }
  
  // Return as-is if already normalized (extract only needed fields)
  return {
    workflowId: eventData.workflowId,
    nodeId: eventData.nodeId,
    event: eventData.event,
    result: eventData.result,
    timestamp: eventData.timestamp ? new Date(eventData.timestamp) : new Date()
  };
};

// Validate event data
const validateEventData = (eventData) => {
  if (!eventData.workflowId) {
    throw new Error('workflowId is required');
  }
  if (!eventData.event) {
    throw new Error('event type is required');
  }
  if (!eventData.nodeId) {
    throw new Error('nodeId is required');
  }
};

// Process events and aggregate updates
const processWorkflowEvents = (events) => {
  const workflowUpdates = new Map();
  
  for (const eventData of events) {
    const processedData = normalizeEventData(eventData);
    
    try {
      validateEventData(processedData);
    } catch (error) {
      logger.warn('Invalid event data:', { error: error.message, eventData });
      continue;
    }

    const workflowId = processedData.workflowId;

    if (!workflowUpdates.has(workflowId)) {
      workflowUpdates.set(workflowId, {
        $inc: {},
        $set: {}
      });
    }

    const update = workflowUpdates.get(workflowId);
    const nodeStatsKey = `analytics.nodeStats.${processedData.nodeId}`;

    // Aggregate updates by event type
    switch (processedData.event) {
      case 'workflow_trigger':
        update.$inc['analytics.totalTriggers'] = (update.$inc['analytics.totalTriggers'] || 0) + 1;
        update.$inc['analytics.totalRuns'] = (update.$inc['analytics.totalRuns'] || 0) + 1;
        update.$inc[`${nodeStatsKey}.triggers`] = (update.$inc[`${nodeStatsKey}.triggers`] || 0) + 1;
        update.$set['analytics.lastTriggered'] = new Date();
        break;

      case 'workflow_completed':
        update.$inc['analytics.successfulRuns'] = (update.$inc['analytics.successfulRuns'] || 0) + 1;
        break;

      case 'workflow_stopped':
        update.$inc['analytics.failedRuns'] = (update.$inc['analytics.failedRuns'] || 0) + 1;
        break;

      case 'condition_evaluated':
        const conditionField = processedData.result === 'passed' ? 'conditionsPassed' : 'conditionsFailed';
        update.$inc[`${nodeStatsKey}.${conditionField}`] = (update.$inc[`${nodeStatsKey}.${conditionField}`] || 0) + 1;
        break;

      case 'action_completed':
        update.$inc['analytics.totalCompletions'] = (update.$inc['analytics.totalCompletions'] || 0) + 1;
        update.$inc[`${nodeStatsKey}.completions`] = (update.$inc[`${nodeStatsKey}.completions`] || 0) + 1;
        break;

      case 'action_failed':
        update.$inc[`${nodeStatsKey}.failures`] = (update.$inc[`${nodeStatsKey}.failures`] || 0) + 1;
        break;

      case 'action_skipped':
        update.$inc[`${nodeStatsKey}.skipped`] = (update.$inc[`${nodeStatsKey}.skipped`] || 0) + 1;
        break;
    }
  }
  
  return workflowUpdates;
};

// Execute bulk database updates
const executeBulkUpdates = async (workflowUpdates) => {
  if (workflowUpdates.size === 0) {
    return { success: true, processed: 0 };
  }

  const bulkOps = [];
  for (const [workflowId, update] of workflowUpdates) {
    if (Object.keys(update.$inc).length > 0 || Object.keys(update.$set).length > 0) {
      const updateDoc = {};
      if (Object.keys(update.$inc).length > 0) updateDoc.$inc = update.$inc;
      if (Object.keys(update.$set).length > 0) updateDoc.$set = update.$set;

      bulkOps.push({
        updateOne: {
          filter: { _id: workflowId },
          update: updateDoc,
          upsert: false
        }
      });
    }
  }

  if (bulkOps.length > 0) {
    await Workflow.bulkWrite(bulkOps);
  }

  return { success: true, processed: bulkOps.length };
};

// Unified event tracking function (handles both single events and batches)
export const trackWorkflowEvents = async (events) => {
  try {
    // Normalize input to array
    const eventArray = Array.isArray(events) ? events : [events];
    
    if (eventArray.length === 0) {
      return { success: true, processed: 0 };
    }

    // Process events and get aggregated updates
    const workflowUpdates = processWorkflowEvents(eventArray);
    
    // Execute bulk updates
    const result = await executeBulkUpdates(workflowUpdates);
    
    logger.debug(`Processed ${eventArray.length} workflow events for ${workflowUpdates.size} workflows`);
    
    return { success: true, processed: eventArray.length };
  } catch (error) {
    logger.error('Error tracking workflow events:', error);
    throw error;
  }
};


// Get workflow analytics
export const getWorkflowAnalytics = async (workflowId, dateRange = {}) => {
    try {
      // Get workflow with aggregated analytics
      const workflow = await Workflow.findById(workflowId).lean();
      
      if (!workflow) {
        throw new Error('Workflow not found');
      }

      const analytics = workflow.analytics || {};
      const nodeStats = analytics.nodeStats || new Map();
      
      // Convert Map to object for JSON serialization
      const nodeStatsObject = {};
      for (const [nodeId, stats] of Object.entries(nodeStats)) {
        const node = workflow.nodes.find(n => n.id === nodeId);
        
        nodeStatsObject[nodeId] = {
          ...stats,
          nodeTitle: node?.data?.title || 'Unknown Node',
          nodeType: node?.data?.type || 'Unknown'
        };
      }

      const totalTriggers = analytics.totalTriggers || 0;
      const totalCompletions = analytics.totalCompletions || 0;
      const conversionRate = totalTriggers > 0 
        ? ((totalCompletions / totalTriggers) * 100).toFixed(1) 
        : '0.0';

      return {
        // Overall workflow stats
        totalTriggers,
        totalCompletions,
        totalRuns: analytics.totalRuns || 0,
        successfulRuns: analytics.successfulRuns || 0,
        failedRuns: analytics.failedRuns || 0,
        conversionRate: `${conversionRate}%`,
        successRate: analytics.totalRuns > 0 
          ? `${((analytics.successfulRuns || 0) / analytics.totalRuns * 100).toFixed(1)}%`
          : '0.0%',
        lastTriggered: analytics.lastTriggered,
        
        // Node-wise analytics
        nodeStats: nodeStatsObject,
        
        // Summary by node type
        nodeTypeSummary: summarizeByNodeType(nodeStatsObject),
        
        // Performance insights
        insights: generateInsights(analytics, nodeStatsObject)
      };
    } catch (error) {
      logger.error('Error getting workflow analytics:', error);
      throw error;
    }
};

// Summarize by node type
const summarizeByNodeType = (nodeStats) => {
    const summary = {
      triggers: { count: 0, executions: 0 },
      conditions: { count: 0, passed: 0, failed: 0 },
      actions: { count: 0, completions: 0, failures: 0, skipped: 0 }
    };

    Object.values(nodeStats).forEach(stats => {
      switch (stats.nodeType) {
        case 'Trigger':
          summary.triggers.count++;
          summary.triggers.executions += stats.triggers || 0;
          break;
        case 'Condition':
          summary.conditions.count++;
          summary.conditions.passed += stats.conditionsPassed || 0;
          summary.conditions.failed += stats.conditionsFailed || 0;
          break;
        case 'Action':
          summary.actions.count++;
          summary.actions.completions += stats.completions || 0;
          summary.actions.failures += stats.failures || 0;
          summary.actions.skipped += stats.skipped || 0;
          break;
      }
    });

    return summary;
};

// Generate insights
const generateInsights = (analytics, nodeStats) => {
    const insights = [];
    
    // Conversion rate insight
    const conversionRate = analytics.totalTriggers > 0 
      ? (analytics.totalCompletions / analytics.totalTriggers * 100)
      : 0;
    
    if (conversionRate > 80) {
      insights.push({
        type: 'success',
        message: 'Excellent conversion rate! Your workflow is performing very well.'
      });
    } else if (conversionRate > 50) {
      insights.push({
        type: 'info',
        message: 'Good conversion rate. Consider optimizing conditions for better performance.'
      });
    } else if (conversionRate > 0) {
      insights.push({
        type: 'warning',
        message: 'Low conversion rate. Review your workflow conditions and triggers.'
      });
    }

    // Node performance insights
    Object.entries(nodeStats).forEach(([nodeId, stats]) => {
      if (stats.nodeType === 'Action' && stats.skipped > stats.completions) {
        insights.push({
          type: 'warning',
          message: `Action "${stats.nodeTitle}" is being skipped frequently due to frequency limits.`
        });
      }
      
      if (stats.nodeType === 'Condition' && stats.conditionsFailed > stats.conditionsPassed) {
        insights.push({
          type: 'info',
          message: `Condition "${stats.nodeTitle}" fails more often than it passes. Consider adjusting criteria.`
        });
      }
    });

    return insights;
};