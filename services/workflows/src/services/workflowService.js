import Workflow from '../models/Workflow.js';
import { logger } from '../utils/logger.js';
import { validateWorkflow } from '../utils/validators.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors.js';

// Helper method to clean workflow data from UI-specific properties
const cleanWorkflowData = (workflowData) => {
  const cleanData = { ...workflowData };
  
  // Clean nodes - remove UI-specific properties
  if (cleanData.nodes && Array.isArray(cleanData.nodes)) {
    cleanData.nodes = cleanData.nodes.map(node => {
      const { selected, dragging, positionAbsolute, measured, resizing, style, width, height, ...cleanNode } = node;
      return cleanNode;
    });
  }
  
  // Clean edges - remove UI-specific properties if any
  if (cleanData.edges && Array.isArray(cleanData.edges)) {
    cleanData.edges = cleanData.edges.map(edge => {
      const { selected, markerEnd, markerStart, style, ...cleanEdge } = edge;
      return cleanEdge;
    });
  }
  
  return cleanData;
};

// Helper method to remove MongoDB-specific fields that shouldn't be saved
const removeMongoFields = (data) => {
  const { _id, __v, createdAt, updatedAt, ...cleanData } = data;
  return cleanData;
};

// Create workflow
export const createWorkflow = async (workflowData, userId) => {
  try {
    // Clean workflow data from UI-specific properties
    const cleanData = cleanWorkflowData(workflowData);
    
    // Remove userId from validation data (it's added separately)
    const { userId: _, ...validationData } = cleanData;
    
    // Validate workflow data (only for creation)
    const validationResult = validateWorkflow(validationData);
    if (validationResult.error) {
      throw new ValidationError(validationResult.error.details[0].message);
    }

    const workflowDoc = new Workflow({
      ...cleanData,
      userId,
      status: cleanData.status || 'Draft',
      analytics: {
        totalTriggers: 0,
        totalCompletions: 0,
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
        averageCompletionTime: 0,
        nodeStats: new Map()
      }
    });

    const savedWorkflow = await workflowDoc.save();
    
    logger.info(`Workflow created: ${savedWorkflow._id}`, { userId, workflowName: savedWorkflow.name });
    
    return {
      id: savedWorkflow._id.toString(),
      ...savedWorkflow.toObject()
    };
  } catch (error) {
    logger.error('Error creating workflow:', error);
    throw error;
  }
};

// Get workflow
export const getWorkflow = async (workflowId, userId) => {
  try {
    const workflow = await Workflow.findById(workflowId);
    
    if (!workflow) {
      throw new NotFoundError('Workflow not found');
    }

    // Allow system user to access any workflow (for execution)
    if (userId !== 'system' && workflow.userId !== userId) {
      throw new ForbiddenError('Access denied');
    }

    const obj = workflow.toObject();
    const triggers = obj.analytics?.totalTriggers || 0;
    const completions = obj.analytics?.totalCompletions || 0;
    const rate = triggers > 0 ? Math.min(100, (completions / triggers) * 100) : 0;
    const completionRate = `${rate.toFixed(1)}%`;
    return {
      id: workflow._id.toString(),
      ...obj,
      completionRate, // Computed field for backward compatibility
    };
  } catch (error) {
    logger.error('Error getting workflow:', error);
    throw error;
  }
};

// Get workflow count (kept for compatibility but no limits enforced in open source)
export const getWorkflowCount = async (userId) => {
  try {
    const count = await Workflow.countDocuments({ userId });
    return count;
  } catch (error) {
    logger.error('Error getting workflow count:', error);
    throw error;
  }
};

// Update workflow
export const updateWorkflow = async (workflowId, updateData, userId) => {
  try {
    const existingWorkflow = await Workflow.findById(workflowId);
    
    if (!existingWorkflow) {
      throw new NotFoundError('Workflow not found');
    }
    
    if (existingWorkflow.userId !== userId) {
      throw new ForbiddenError('Access denied');
    }
    
    // Clean update data from UI-specific properties
    const cleanUpdateData = cleanWorkflowData(updateData);
    
    // Remove MongoDB-specific fields that shouldn't be updated
    const finalUpdateData = removeMongoFields(cleanUpdateData);
    
    // Remove userId from update data if it's present (it shouldn't change)
    const { userId: _, ...updateDataWithoutUserId } = finalUpdateData;

    const updatedWorkflow = await Workflow.findByIdAndUpdate(
      workflowId,
      updateDataWithoutUserId,
      { new: true, runValidators: true }
    );
    
    logger.info(`Workflow updated: ${workflowId}`, { userId });
    
    return {
      id: updatedWorkflow._id.toString(),
      ...updatedWorkflow.toObject()
    };
  } catch (error) {
    logger.error('Error updating workflow:', error);
    throw error;
  }
};

// Delete workflow
export const deleteWorkflow = async (workflowId, userId) => {
    try {
      const workflow = await Workflow.findById(workflowId);
      
      if (!workflow) {
        throw new NotFoundError('Workflow not found');
      }
      
      if (workflow.userId !== userId) {
        throw new ForbiddenError('Access denied');
      }
      
      await Workflow.findByIdAndDelete(workflowId);
      
      logger.info(`Workflow deleted: ${workflowId}`, { userId });
      
      return { message: 'Workflow deleted successfully' };
    } catch (error) {
      logger.error('Error deleting workflow:', error);
      throw error;
    }
};

// Note: getWorkflows recalculates completion rates to ensure consistency with getWorkflow
// This prevents discrepancies between list view and individual workflow view
export const getWorkflows = async (userId, filters = {}) => {
    try {
      let query = { userId };
      
      if (filters.status) {
        query.status = filters.status;
      }
      
      if (filters.siteId) {
        query.siteId = filters.siteId;
      }
      
      const workflows = await Workflow.find(query)
        .sort({ createdAt: -1 })
        .lean();
      
      return workflows.map(workflow => {
        // Calculate completion rate from analytics data
        const triggers = workflow.analytics?.totalTriggers || 0;
        const completions = workflow.analytics?.totalCompletions || 0;
        const rate = triggers > 0 ? Math.min(100, (completions / triggers) * 100) : 0;
        const completionRate = `${rate.toFixed(1)}%`;
        
        return {
          id: workflow._id.toString(),
          ...workflow,
          completionRate, // Computed field for backward compatibility
        };
      });
    } catch (error) {
      logger.error('Error getting workflows:', error);
      throw error;
    }
};

// Note: getActiveWorkflows also recalculates completion rates for consistency
export const getActiveWorkflows = async (siteId) => {
    try {
      const workflows = await Workflow.find({
        siteId,
        status: 'Active'
      }).lean();
      
      return workflows.map(workflow => {
        // Calculate completion rate from analytics data
        const triggers = workflow.analytics?.totalTriggers || 0;
        const completions = workflow.analytics?.totalCompletions || 0;
        const rate = triggers > 0 ? Math.min(100, (completions / triggers) * 100) : 0;
        const completionRate = `${rate.toFixed(1)}%`;
        
        return {
          id: workflow._id.toString(),
          ...workflow,
          completionRate, // Computed field for backward compatibility
        };
      });
    } catch (error) {
      logger.error('Error getting active workflows:', error);
      throw error;
    }
};
