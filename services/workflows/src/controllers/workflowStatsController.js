import Workflow from '../models/Workflow.js';
import * as analyticsService from '../services/analyticsService.js';
import { logger } from '../utils/logger.js';

// Get workflow overview stats
export const getWorkflowStats = async (req, res, next) => {
    try {
      const workflowId = req.params.id;
      const analytics = await analyticsService.getWorkflowAnalytics(workflowId);
      
      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Error getting workflow stats:', error);
      next(error);
    }
};

// Get node-wise performance breakdown
export const getNodePerformance = async (req, res, next) => {
    try {
      const workflowId = req.params.id;
      const workflow = await Workflow.findById(workflowId).lean();
      
      if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found' });
      }

      const nodeStats = workflow.analytics?.nodeStats || {};
      const nodePerformance = [];

      // Convert node stats to array with node details
      Object.entries(nodeStats).forEach(([nodeId, stats]) => {
        const node = workflow.nodes.find(n => n.id === nodeId);
        if (node) {
          const totalExecutions = (stats.completions || 0) + (stats.failures || 0) + (stats.skipped || 0);
          const successRate = totalExecutions > 0 
            ? ((stats.completions || 0) / totalExecutions * 100).toFixed(1)
            : '0.0';

          nodePerformance.push({
            nodeId,
            nodeTitle: node.data.title,
            nodeType: node.data.type,
            iconName: node.data.iconName,
            color: node.data.color,
            stats: {
              ...stats,
              totalExecutions,
              successRate: `${successRate}%`
            }
          });
        }
      });

      // Sort by total executions (most active first)
      nodePerformance.sort((a, b) => 
        (b.stats.totalExecutions || 0) - (a.stats.totalExecutions || 0)
      );

      res.json({
        success: true,
        data: nodePerformance
      });
    } catch (error) {
      logger.error('Error getting node performance:', error);
      next(error);
    }
};

// Get workflow summary for dashboard
export const getWorkflowSummary = async (req, res, next) => {
    try {
      const { siteId } = req.query;
      
      if (!siteId) {
        return res.status(400).json({ error: 'siteId is required' });
      }

      const workflows = await Workflow.find({ 
        siteId, 
        status: 'Active' 
      }).lean();

      const summary = {
        totalWorkflows: workflows.length,
        totalTriggers: 0,
        totalCompletions: 0,
        averageConversionRate: 0,
        activeWorkflows: 0,
        topPerformers: []
      };

      let totalConversionRate = 0;
      const workflowPerformance = [];

      workflows.forEach(workflow => {
        const analytics = workflow.analytics || {};
        const triggers = analytics.totalTriggers || 0;
        const completions = analytics.totalCompletions || 0;
        const conversionRate = triggers > 0 ? (completions / triggers * 100) : 0;

        summary.totalTriggers += triggers;
        summary.totalCompletions += completions;
        
        if (triggers > 0) {
          summary.activeWorkflows++;
          totalConversionRate += conversionRate;
        }

        workflowPerformance.push({
          id: workflow._id,
          name: workflow.name,
          triggers,
          completions,
          conversionRate: conversionRate.toFixed(1),
          lastTriggered: analytics.lastTriggered
        });
      });

      summary.averageConversionRate = summary.activeWorkflows > 0 
        ? (totalConversionRate / summary.activeWorkflows).toFixed(1)
        : '0.0';

      // Get top 5 performers by conversion rate
      summary.topPerformers = workflowPerformance
        .filter(w => w.triggers > 0)
        .sort((a, b) => parseFloat(b.conversionRate) - parseFloat(a.conversionRate))
        .slice(0, 5);

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('Error getting workflow summary:', error);
      next(error);
    }
};

// Reset workflow analytics (for testing/debugging)
export const resetWorkflowStats = async (req, res, next) => {
    try {
      const workflowId = req.params.id;
      
      await Workflow.findByIdAndUpdate(workflowId, {
        $set: {
          'analytics.totalTriggers': 0,
          'analytics.totalCompletions': 0,
          'analytics.totalRuns': 0,
          'analytics.successfulRuns': 0,
          'analytics.failedRuns': 0,
          'analytics.averageCompletionTime': 0,
          'analytics.nodeStats': new Map(),
          'analytics.lastTriggered': null
        }
      });

      res.json({
        success: true,
        message: 'Workflow analytics reset successfully'
      });
    } catch (error) {
      logger.error('Error resetting workflow stats:', error);
      next(error);
    }
};
