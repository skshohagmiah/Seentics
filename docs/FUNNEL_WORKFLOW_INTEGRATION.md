# Workflow Analytics Integration

## Overview

The Workflow Analytics Integration provides real-time tracking and analysis of workflow performance, user interactions, and conversion metrics. This system creates a seamless connection between workflow execution and comprehensive analytics data.

## 🎯 What It Does

When users interact with your workflows (triggers, conditions, actions), the system automatically tracks and aggregates performance data. This enables:

- **Real-time performance monitoring** of workflow effectiveness
- **Detailed node-level analytics** for optimization insights
- **Conversion rate tracking** across workflow steps
- **Automated insights generation** for performance improvements
- **Batch processing** for high-performance data collection

## 🏗️ Architecture

```
Frontend Tracker → Workflow Analytics API → MongoDB Counters → Dashboard Analytics
       ↓                    ↓                    ↓                ↓
   Batches events      Processes events    Updates embedded    Displays real-time
   every 2 seconds     and aggregates      workflow counters   performance metrics
                       by workflow ID      and node stats      and insights
```

## 🚀 Key Features

### **Event Types Tracked**
- **workflow_trigger**: When a workflow is initiated
- **workflow_completed**: When a workflow finishes successfully
- **workflow_stopped**: When a workflow fails or is stopped
- **action_completed**: When an action node executes successfully
- **action_failed**: When an action node fails
- **action_skipped**: When an action is skipped due to frequency limits
- **condition_evaluated**: When a condition is evaluated (passed/failed)

### **Analytics Capabilities**
- **Real-time Counters**: Embedded counters for instant performance data
- **Batch Processing**: Efficient event aggregation every 2 seconds
- **Node-level Stats**: Detailed performance metrics per workflow node
- **Conversion Tracking**: Trigger-to-completion conversion rates
- **Performance Insights**: Automated recommendations for optimization

### **Data Storage & Performance**
- **Embedded Analytics**: Counters stored directly in workflow documents
- **MongoDB Optimization**: Efficient bulk write operations
- **No Individual Events**: Only aggregated data for better performance
- **Virtual Properties**: Computed fields for backward compatibility

## 📱 Frontend Components

### **Workflow Analytics Dashboard**
- Real-time workflow performance metrics
- Node-level execution statistics
- Conversion rate visualization
- Performance insights and recommendations

### **Workflow Tracker (JavaScript)**
- Automatic event batching every 2 seconds
- Optimized payload structure for performance
- Real-time workflow execution tracking
- Error handling and retry logic

## 🔧 Backend Implementation

### **Workflow Analytics Service (Node.js)**
```javascript
// Unified event tracking function
export const trackWorkflowEvents = async (events) => {
  const eventArray = Array.isArray(events) ? events : [events];
  const workflowUpdates = processWorkflowEvents(eventArray);
  return await executeBulkUpdates(workflowUpdates);
};

// Process and aggregate events by workflow
const processWorkflowEvents = (events) => {
  const workflowUpdates = new Map();
  
  for (const eventData of events) {
    const processedData = normalizeEventData(eventData);
    // Aggregate counters by workflow and node
    aggregateEventUpdates(processedData, workflowUpdates);
  }
  
  return workflowUpdates;
};

// Execute bulk MongoDB updates
const executeBulkUpdates = async (workflowUpdates) => {
  const bulkOps = [];
  for (const [workflowId, update] of workflowUpdates) {
    bulkOps.push({
      updateOne: {
        filter: { _id: workflowId },
        update: { $inc: update.$inc, $set: update.$set }
      }
    });
  }
  
  if (bulkOps.length > 0) {
    await Workflow.bulkWrite(bulkOps);
  }
};
```

## 📊 API Endpoints

### **Workflow Analytics**
- `POST /api/v1/workflows/analytics/track` - Track single workflow event
- `POST /api/v1/workflows/analytics/track/batch` - Track multiple events (recommended)
- `GET /api/v1/workflows/analytics/workflow/:workflowId` - Get workflow analytics
- `GET /api/v1/workflows/:id/stats` - Get comprehensive workflow statistics
- `GET /api/v1/workflows/:id/stats/nodes` - Get node-level performance data
- `GET /api/v1/workflows/stats/summary` - Get dashboard summary for all workflows

## 💡 Use Cases

### **Workflow Performance Monitoring**
```
Scenario: E-commerce checkout workflow
Tracked Events:
  - workflow_trigger: User starts checkout
  - condition_evaluated: Payment method validation
  - action_completed: Order confirmation email sent
  - workflow_completed: Checkout process finished

Analytics Provided:
  - Conversion rate: 85% (850 completions / 1000 triggers)
  - Node performance: Payment validation passes 95% of time
  - Insights: "Consider simplifying payment form"
```

### **A/B Testing Workflow Optimization**
```
Scenario: Lead generation workflow variants
Workflow A: Simple form → Thank you page
Workflow B: Multi-step form → Personalized thank you

Tracked Metrics:
  - Trigger rates for each variant
  - Completion rates and conversion
  - Node-level performance comparison
  - Automated insights on best performer
```

### **Real-time Performance Alerts**
```
Scenario: Critical business workflow monitoring
Alert Conditions:
  - Conversion rate drops below 70%
  - Action failure rate exceeds 5%
  - No triggers received in 30 minutes

Automated Actions:
  - Send Slack notification to team
  - Create support ticket
  - Scale infrastructure if needed
```

## 🛠️ Setup & Configuration

### **1. Environment Variables**
```bash
# Workflow Service Configuration
PORT=3003
MONGODB_URI=mongodb://localhost:27017/workflows
REDIS_URL=redis://localhost:6379
QUEUE_CONCURRENCY=5

# Analytics Configuration
BATCH_SIZE=1000
BATCH_TIMEOUT=2000  # 2 seconds
MAX_EVENTS_PER_BATCH=100
```

### **2. MongoDB Schema**
```javascript
// Workflow document with embedded analytics
{
  _id: ObjectId,
  name: "Checkout Workflow",
  siteId: "site-123",
  status: "Active",
  nodes: [...],
  edges: [...],
  
  // Embedded analytics counters
  analytics: {
    totalTriggers: 1250,
    totalCompletions: 1063,
    totalRuns: 1250,
    successfulRuns: 1200,
    failedRuns: 50,
    lastTriggered: ISODate("2024-01-15T10:30:00Z"),
    
    // Node-level statistics
    nodeStats: {
      "trigger-node-1": {
        triggers: 1250,
        completions: 1250
      },
      "condition-node-2": {
        conditionsPassed: 1200,
        conditionsFailed: 50
      },
      "action-node-3": {
        completions: 1063,
        failures: 137,
        skipped: 50
      }
    }
  },
  
  // Virtual properties (computed)
  completionRate: "85.0%",  // Computed from analytics
  successRate: "96.0%"      // Computed from analytics
}
```

### **3. Frontend Integration**
```javascript
// Automatic event tracking (workflow-tracker.js)
window.seentics = {
  siteId: 'your-site-id',
  debug: false  // Enable for development
};

// Events are automatically batched and sent every 2 seconds
// No manual tracking required - the system handles everything
```

### **4. Performance Monitoring**
```javascript
// Example analytics response
{
  "totalTriggers": 1250,
  "totalCompletions": 1063,
  "conversionRate": "85.0%",
  "successfulRuns": 1200,
  "failedRuns": 50,
  "lastTriggered": "2024-01-15T10:30:00Z",
  "nodeStats": {
    "trigger-node-1": {
      "triggers": 1250,
      "completions": 1250,
      "nodeTitle": "Page View Trigger",
      "nodeType": "Trigger"
    },
    "action-node-3": {
      "completions": 1063,
      "failures": 137,
      "skipped": 50,
      "nodeTitle": "Send Email",
      "nodeType": "Action"
    }
  },
  "insights": [
    {
      "type": "warning",
      "message": "Action 'Send Email' has high failure rate (11.4%). Check email service configuration."
    },
    {
      "type": "info", 
      "message": "Workflow conversion rate is above average. Consider scaling this workflow."
    }
  ]
}
```

## 🚀 Getting Started

1. **Install tracking script** in your website
2. **Create workflows** in the dashboard
3. **Monitor performance** in real-time
4. **Optimize based on insights** provided by the system

The system automatically handles all event tracking, batching, and analytics generation with no additional configuration required.

## 🧪 Testing

### **Run Integration Tests**
```bash
cd services/workflows
npm install axios
node test-funnel-integration.js
```

### **Manual Testing**
1. Create a funnel in analytics
2. Create a workflow with funnel trigger
3. Simulate funnel events
4. Verify workflow execution

## 📈 Monitoring & Analytics

### **Trigger Statistics**
- Total triggers created
- Active vs inactive triggers
- Execution count per trigger
- Recent activity timeline

### **Performance Metrics**
- Event processing latency
- Workflow execution success rate
- Trigger condition evaluation time
- System resource usage

## 🔒 Security & Privacy

### **Authentication**
- All API endpoints require authentication
- Service-to-service communication uses internal network
- User data is encrypted in transit

### **Data Privacy**
- Funnel events contain minimal PII
- User segmentation respects privacy settings
- GDPR compliance built-in

## 🚀 Future Enhancements

### **Planned Features**
- **AI-powered triggers**: Predictive funnel behavior
- **Dynamic workflows**: Adaptive customer journeys
- **Multi-channel orchestration**: Cross-platform automation
- **Advanced segmentation**: Machine learning user groups

### **Integration Roadmap**
- **CRM systems**: Salesforce, HubSpot, Pipedrive
- **Marketing tools**: Mailchimp, ActiveCampaign
- **E-commerce platforms**: Shopify, WooCommerce
- **Payment processors**: Stripe, PayPal

## 🆘 Troubleshooting

### **Common Issues**

#### **Events Not Triggering**
- Check trigger is active
- Verify funnel ID matches
- Confirm event type is correct
- Check workflow service connectivity

#### **Workflows Not Executing**
- Validate workflow status is "Active"
- Check trigger conditions
- Verify user segmentation
- Review workflow node configuration

#### **Performance Issues**
- Monitor database query performance
- Check Redis connection
- Review trigger cache loading
- Optimize condition evaluation

### **Debug Mode**
```bash
# Enable debug logging
export LOG_LEVEL=debug
export DEBUG_FUNNEL_EVENTS=true
```

## 📚 Additional Resources

- [Workflow Builder Documentation](./WORKFLOW_BUILDER.md)
- [Analytics API Reference](./API_REFERENCE.md)
- [Funnel Analytics Guide](./FUNNEL_ANALYTICS.md)
- [System Architecture Overview](./SYSTEM_ARCHITECTURE_OVERVIEW.md)

## 🤝 Contributing

To contribute to this feature:

1. Fork the repository
2. Create feature branch
3. Implement changes
4. Add tests
5. Submit pull request

## 📄 License

This feature is part of the Seentics platform and follows the same licensing terms.
