# Seentics Documentation

Welcome to the comprehensive documentation for Seentics - an open-source analytics and automation platform.

## 📚 Documentation Overview

This documentation covers all aspects of the Seentics platform, from getting started to advanced configuration and development.

### 🚀 **Getting Started**
- [Quick Start Guide](../README.md#-quick-start) - Get up and running in minutes
- [Installation Guide](../README.md#-configuration) - Detailed setup instructions
- [First Workflow Tutorial](#creating-your-first-workflow) - Step-by-step workflow creation

### 🏗️ **Architecture & Services**
- [System Architecture Overview](./SYSTEM_ARCHITECTURE_OVERVIEW.md) - Complete system design
- [Analytics Service](./ANALYTICS_SERVICE.md) - High-performance event processing
- [User Management Service](./USER_MANAGEMENT_MICROSERVICE.md) - Authentication and user management
- [Workflow Engine](./WORKFLOW_ENGINE_MICROSERVICE.md) - Automation and workflow execution

### 📊 **Features & Capabilities**
- [Platform Features](./features.md) - Comprehensive feature overview
- [Funnel & Workflow Integration](./FUNNEL_WORKFLOW_INTEGRATION.md) - Advanced automation patterns
- [API Reference](./API_REFERENCE.md) - Complete API documentation

### 🔧 **Development & Integration**
- [API Integration Guide](#api-integration) - How to integrate with Seentics APIs
- [Tracking Script Setup](#tracking-scripts) - Website integration
- [Webhook Configuration](#webhooks) - External system integration

## 🎯 Creating Your First Workflow

### Step 1: Add Your Website
1. Sign up at your Seentics instance
2. Navigate to "Websites" and click "Add Website"
3. Enter your website name and URL
4. Copy the provided tracking code

### Step 2: Install Tracking Code
Add the tracking code to your website's `<head>` section:

```html
<!-- Seentics Analytics & Automation -->
<script>
  window.seentics = window.seentics || [];
  window.seentics.siteId = 'your-site-id';
</script>
<script src="http://your-seentics-instance/trackers/funnel-tracker.js" async></script>
<script src="http://your-seentics-instance/trackers/workflow-tracker.js" async></script>
```

### Step 3: Create Your First Workflow
1. Go to "Workflows" and click "Create Workflow"
2. Choose a trigger (e.g., "Page View", "Time on Page", "Exit Intent")
3. Add conditions (e.g., "URL contains", "Traffic source", "Device type")
4. Configure actions (e.g., "Show Modal", "Track Event", "Send Webhook")
5. Test and activate your workflow

## 📊 Analytics Dashboard

### Key Metrics
- **Real-time Visitors**: Current active users on your site
- **Page Views**: Total page views with trend analysis
- **Conversion Funnels**: Multi-step conversion tracking
- **Workflow Performance**: Automation effectiveness metrics

### Reports Available
- **Top Pages**: Most visited pages with engagement metrics
- **Traffic Sources**: Referrer analysis and campaign tracking
- **Device & Browser**: Technology and device breakdown
- **Geographic**: Visitor location and country analysis
- **Custom Events**: Track specific user interactions

### 🔌 API Integration

### Authentication
All API requests require JWT authentication:

```javascript
const response = await fetch('http://your-instance/api/v1/analytics/dashboard/website-id', {
  headers: {
    'Authorization': `Bearer ${your-jwt-token}`,
    'Content-Type': 'application/json'
  }
});
```

### Workflow Event Tracking API
Track workflow events programmatically:

```javascript
// Single workflow event
await fetch('http://your-instance/api/v1/workflows/analytics/track', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    t: 'wf',                    // Event type marker
    wf: 'workflow-id',          // Workflow ID
    n: 'node-id',               // Node ID
    e: 'workflow_trigger',      // Event name
    w: 'your-site-id',          // Site ID
    v: 'visitor-id',            // Visitor ID
    ts: Date.now()              // Timestamp
  })
});

// Batch workflow events (recommended for performance)
await fetch('http://your-instance/api/v1/workflows/analytics/track/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    events: [
      { t: 'wf', wf: 'workflow-1', e: 'workflow_trigger', n: 'trigger-node', ts: Date.now() },
      { t: 'wf', wf: 'workflow-1', e: 'action_completed', n: 'action-node', ts: Date.now() },
      { t: 'wf', wf: 'workflow-2', e: 'condition_evaluated', n: 'condition-node', r: 'passed', ts: Date.now() }
    ]
  })
});

// Get workflow analytics
const analytics = await fetch('http://your-instance/api/v1/workflows/analytics/workflow/workflow-id', {
  headers: { 'Authorization': `Bearer ${token}` }
});
// Returns: { totalTriggers, totalCompletions, conversionRate, nodeStats, etc. }
```

## 📝 Tracking Scripts

### Funnel Tracker
Automatically tracks conversion funnels and user journeys:

```html
<script src="http://your-instance/trackers/funnel-tracker.js" async></script>
```

Features:
- Automatic page view tracking
- Conversion funnel detection
- User session management
- Custom event tracking

### Workflow Tracker
Enables real-time workflow automation:

```html
<script src="http://your-instance/trackers/workflow-tracker.js" async></script>
```

Features:
- Real-time trigger detection
- Workflow execution
- A/B testing support
- Dynamic content injection

## 🔗 Webhooks

Configure webhooks to integrate with external systems:

### Webhook Events
- `workflow.executed` - When a workflow runs
- `funnel.completed` - When a user completes a funnel
- `event.tracked` - When a custom event is tracked
- `user.converted` - When a conversion goal is met

### Webhook Configuration
```json
{
  "url": "https://your-system.com/webhook",
  "events": ["workflow.executed", "funnel.completed"],
  "secret": "your-webhook-secret",
  "active": true
}
```

### Webhook Payload Example
```json
{
  "event": "workflow.executed",
  "timestamp": "2024-12-19T10:00:00Z",
  "data": {
    "workflowId": "workflow-123",
    "websiteId": "site-456",
    "visitorId": "visitor-789",
    "trigger": "page_view",
    "actions": ["show_modal", "track_event"]
  }
}
```

## 🛠️ Advanced Configuration

### Environment Variables
Key configuration options for production deployment:

```bash
# Workflow Service Configuration
PORT=3003                          # Workflow service port
MONGODB_URI=mongodb://localhost:27017/workflows  # MongoDB connection
REDIS_URL=redis://localhost:6379   # Redis for queues and caching

# Analytics Service Configuration (Go)
PORT=8080                          # Analytics service port
DB_HOST=localhost                  # TimescaleDB host
DB_PORT=5432                       # TimescaleDB port
DB_NAME=seentics_analytics         # Database name

# Performance Tuning
BATCH_SIZE=1000                    # Event batch processing size
WORKER_COUNT=10                    # Number of background workers
CACHE_TTL=300                      # Redis cache TTL in seconds
QUEUE_CONCURRENCY=5                # Queue processing concurrency

# Security
JWT_SECRET=your-secure-secret      # JWT signing secret
RATE_LIMIT_PER_MINUTE=1000        # API rate limiting
CORS_ORIGIN=https://yourdomain.com # CORS allowed origins

### Database Optimization

#### TimescaleDB (Analytics Service)
For high-traffic sites, consider these TimescaleDB optimizations:

```sql
-- Create indexes for better query performance
CREATE INDEX CONCURRENTLY idx_events_website_timestamp 
ON events (website_id, timestamp DESC);

-- Configure compression for older data
SELECT add_compression_policy('events', INTERVAL '7 days');

-- Set up data retention policy
SELECT add_retention_policy('events', INTERVAL '1 year');
```

#### MongoDB (Workflow Service)
Optimize MongoDB for workflow analytics:

```javascript
// Create indexes for workflow queries
db.workflows.createIndex({ "userId": 1, "status": 1 });
db.workflows.createIndex({ "siteId": 1, "status": 1 });
db.workflows.createIndex({ "createdAt": -1 });

// Optimize analytics queries
db.workflows.createIndex({ "analytics.totalTriggers": -1 });
db.workflows.createIndex({ "analytics.lastTriggered": -1 });
```

## 🔍 Troubleshooting

### Common Issues

#### Tracking Not Working
1. Check if tracking scripts are loaded correctly
2. Verify website ID matches in dashboard
3. Check browser console for JavaScript errors
4. Ensure CORS is configured properly

#### Workflows Not Triggering
1. Verify workflow is active and published
2. Check trigger conditions are met
3. Review workflow analytics for execution logs
4. Test in different browsers/devices

#### Performance Issues
1. Monitor database query performance
2. Check Redis cache hit rates
3. Review API response times
4. Scale services horizontally if needed

### Debug Mode
Enable debug mode for detailed logging:

```javascript
// In tracking scripts
window.seentics.debug = true;

// In API requests
localStorage.setItem('seentics-debug', 'true');
```

## 📈 Performance Optimization

### Recommended Hardware
- **CPU**: 4+ cores for production
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: SSD with 100GB+ free space
- **Network**: 1Gbps connection for high traffic

### Scaling Guidelines
- **< 1M events/month**: Single server deployment
- **1M - 10M events/month**: Scale analytics service horizontally
- **10M+ events/month**: Consider database sharding and CDN

## 🤝 Contributing to Documentation

Help improve this documentation:

1. **Found an error?** Open an issue on GitHub
2. **Want to add content?** Submit a pull request
3. **Need clarification?** Start a discussion
4. **Have examples?** Share them with the community

### Documentation Standards
- Use clear, concise language
- Include code examples where applicable
- Test all instructions before submitting
- Follow the existing structure and formatting

---

**Need more help?** Check out our [GitHub Discussions](https://github.com/seentics/seentics/discussions) or [open an issue](https://github.com/seentics/seentics/issues).
