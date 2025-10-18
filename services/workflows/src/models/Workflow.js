import mongoose from 'mongoose';

const nodeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, required: true },
  position: {
    x: { type: Number, required: true },
    y: { type: Number, required: true }
  },
  data: {
    iconName: { type: String, required: true },
    title: { type: String, required: true },
    type: { type: String, enum: ['Trigger', 'Condition', 'Action'], required: true },
    color: { type: String, required: true },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
    isServerAction: { type: Boolean, default: false }
  },
  width: Number,
  height: Number
}, { _id: false });

const edgeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  source: { type: String, required: true },
  target: { type: String, required: true },
  sourceHandle: String,
  targetHandle: String,
  animated: { type: Boolean, default: false },
  label: String
}, { _id: false });

const workflowSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 100 },
  category: { type: String, maxlength: 50 },
  status: { type: String, enum: ['Draft', 'Active', 'Paused'], default: 'Draft' },
  siteId: { type: String, required: true },
  userId: { type: String, required: true },
  nodes: [nodeSchema],
  edges: [edgeSchema],
  
  // Analytics counters
  analytics: {
    totalTriggers: { type: Number, default: 0 },
    totalCompletions: { type: Number, default: 0 },
    totalRuns: { type: Number, default: 0 },
    successfulRuns: { type: Number, default: 0 },
    failedRuns: { type: Number, default: 0 },
    averageCompletionTime: { type: Number, default: 0 }, // in milliseconds
    lastTriggered: { type: Date },
    
    // Node-wise counters (simplified structure)
    nodeStats: {
      type: Map,
      of: {
        triggers: { type: Number, default: 0 },
        completions: { type: Number, default: 0 },
        failures: { type: Number, default: 0 },
        skipped: { type: Number, default: 0 },
        conditionsPassed: { type: Number, default: 0 },
        conditionsFailed: { type: Number, default: 0 }
      },
      default: new Map()
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual properties for computed fields (replaces legacy fields)
workflowSchema.virtual('completionRate').get(function() {
  const triggers = this.analytics.totalTriggers || 0;
  const completions = this.analytics.totalCompletions || 0;
  return triggers > 0 ? `${(completions / triggers * 100).toFixed(1)}%` : '0.0%';
});

workflowSchema.virtual('successRate').get(function() {
  const totalRuns = this.analytics.totalRuns || 0;
  const successfulRuns = this.analytics.successfulRuns || 0;
  return totalRuns > 0 ? `${(successfulRuns / totalRuns * 100).toFixed(1)}%` : '0.0%';
});

workflowSchema.virtual('totalTriggers').get(function() {
  return this.analytics.totalTriggers || 0;
});

workflowSchema.virtual('totalCompletions').get(function() {
  return this.analytics.totalCompletions || 0;
});

// Indexes for performance
workflowSchema.index({ userId: 1, status: 1 });
workflowSchema.index({ siteId: 1, status: 1 });
workflowSchema.index({ createdAt: -1 });

const Workflow = mongoose.model('Workflow', workflowSchema);
export default Workflow;