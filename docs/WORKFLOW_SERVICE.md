# Workflow Service Documentation

## 📋 Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [API Endpoints](#api-endpoints)
- [Analytics System](#analytics-system)
- [Database Schema](#database-schema)
- [Performance Features](#performance-features)
- [Configuration](#configuration)
- [Deployment](#deployment)

## 🎯 Overview

The Workflow Service is a high-performance Node.js microservice that handles workflow automation and real-time analytics. It provides workflow execution, event tracking, and comprehensive performance analytics with MongoDB as the primary database.

**Key Capabilities:**
- Real-time workflow execution and automation
- Embedded analytics with counter-based tracking
- Batch event processing for optimal performance
- Node-level performance monitoring
- Automated insights generation
- Queue-based background processing

## 🏗️ Architecture

### High-Level Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │───▶│ Workflow        │───▶│   MongoDB       │
│   Tracker       │    │ Service         │    │   (Workflows)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Redis Cache   │
                       │   & Queues      │
                       └─────────────────┘
```

### Service Architecture Pattern
The service follows a **Clean Architecture** pattern:

```
HTTP Layer (Controllers) → Business Logic (Services) → Data Access (Models) → Database
```

## 🚀 Features

### **Core Workflow Features**
- **Workflow Management**: Create, update, delete, and manage workflows
- **Real-time Execution**: Execute workflows based on triggers and conditions
- **Node Types**: Support for Trigger, Condition, and Action nodes
- **Frequency Control**: Once per session, once ever, or every trigger
- **Queue Processing**: Background job processing with Redis

### **Analytics Features**
- **Real-time Tracking**: Instant event processing and counter updates
- **Batch Processing**: Efficient event aggregation every 2 seconds
- **Embedded Counters**: Analytics stored directly in workflow documents
- **Node-level Stats**: Detailed performance metrics per workflow node
- **Automated Insights**: Smart recommendations based on performance data
- **Virtual Properties**: Computed fields for backward compatibility

### **Performance Features**
- **Bulk Operations**: MongoDB bulkWrite for optimal database performance
- **Event Batching**: Frontend automatically batches events
- **Memory Efficiency**: No individual event storage, only aggregated counters
- **Queue Optimization**: Redis-based job queues with concurrency control

## 📊 API Endpoints

### **Workflow Management**
```
GET    /api/v1/workflows                    # Get all workflows
POST   /api/v1/workflows                    # Create workflow
GET    /api/v1/workflows/:id                # Get workflow by ID
PUT    /api/v1/workflows/:id                # Update workflow
DELETE /api/v1/workflows/:id                # Delete workflow
PATCH  /api/v1/workflows/:id/status         # Update workflow status
```

### **Public Endpoints (for tracker)**
```
GET    /api/v1/workflows/active             # Get active workflows (query-based)
GET    /api/v1/workflows/site/:siteId/active # Get active workflows by site
POST   /api/v1/workflows/execution/action   # Execute workflow action
```

### **Analytics Endpoints**
```
POST   /api/v1/workflows/analytics/track           # Track single event
POST   /api/v1/workflows/analytics/track/batch     # Track batch events (recommended)
GET    /api/v1/workflows/analytics/workflow/:id    # Get workflow analytics
```

### **Statistics Endpoints**
```
GET    /api/v1/workflows/:id/stats          # Get workflow statistics
GET    /api/v1/workflows/:id/stats/nodes    # Get node performance
GET    /api/v1/workflows/stats/summary      # Get dashboard summary
POST   /api/v1/workflows/:id/stats/reset    # Reset workflow stats (testing)
```

## 📈 Analytics System

### **Event Types Tracked**
- **workflow_trigger**: When a workflow is initiated
- **workflow_completed**: When a workflow finishes successfully  
- **workflow_stopped**: When a workflow fails or is stopped
- **action_completed**: When an action node executes successfully
- **action_failed**: When an action node fails
- **action_skipped**: When an action is skipped due to frequency limits
- **condition_evaluated**: When a condition is evaluated (passed/failed)

### **Data Flow**
```
Frontend Tracker → Batch Events (2s) → Analytics API → Process & Aggregate → MongoDB Update
```

### **Event Processing**
```javascript
// Optimized event payload from frontend
{
  t: 'wf',                    // Event type marker
  wf: 'workflow-id',          // Workflow ID
  n: 'node-id',               // Node ID  
  e: 'workflow_trigger',      // Event name
  w: 'site-id',               // Site ID
  v: 'visitor-id',            // Visitor ID
  ts: Date.now()              // Timestamp
}

// Backend processing
1. Normalize event data (extract only needed fields)
2. Validate required fields (workflowId, event, nodeId)
3. Group events by workflow for bulk updates
4. Aggregate counters by event type and node
5. Execute single MongoDB bulkWrite operation
```

### **Analytics Response**
```javascript
{
  "totalTriggers": 1250,
  "totalCompletions": 1063,
  "conversionRate": "85.0%",
  "successfulRuns": 1200,
  "failedRuns": 50,
  "lastTriggered": "2024-01-15T10:30:00Z",
  "nodeStats": {
    "node-123": {
      "triggers": 500,
      "completions": 450,
      "failures": 25,
      "nodeTitle": "Send Email",
      "nodeType": "Action"
    }
  },
  "insights": [
    {
      "type": "warning",
      "message": "Action 'Send Email' has high failure rate. Check configuration."
    }
  ]
}
```

## 🗄️ Database Schema

### **Workflow Document**
```javascript
{
  _id: ObjectId,
  name: "Checkout Workflow",
  category: "E-commerce",
  status: "Active", // Draft, Active, Paused
  siteId: "site-123",
  userId: "user-456",
  nodes: [
    {
      id: "node-1",
      type: "trigger",
      position: { x: 100, y: 100 },
      data: {
        iconName: "eye",
        title: "Page View",
        type: "Trigger",
        color: "#3B82F6",
        settings: { url: "/checkout" }
      }
    }
  ],
  edges: [
    {
      id: "edge-1",
      source: "node-1",
      target: "node-2"
    }
  ],
  
  // Embedded analytics (NEW - optimized structure)
  analytics: {
    totalTriggers: 1250,
    totalCompletions: 1063,
    totalRuns: 1250,
    successfulRuns: 1200,
    failedRuns: 50,
    averageCompletionTime: 2500, // milliseconds
    lastTriggered: ISODate("2024-01-15T10:30:00Z"),
    
    // Node-level statistics
    nodeStats: {
      "node-1": {
        triggers: 1250,
        completions: 1250
      },
      "node-2": {
        conditionsPassed: 1200,
        conditionsFailed: 50
      },
      "node-3": {
        completions: 1063,
        failures: 137,
        skipped: 50
      }
    }
  },
  
  createdAt: ISODate,
  updatedAt: ISODate
}
```

### **Virtual Properties (Computed Fields)**
```javascript
// These are computed automatically, not stored
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
```

### **Database Indexes**
```javascript
// Performance indexes
db.workflows.createIndex({ "userId": 1, "status": 1 });
db.workflows.createIndex({ "siteId": 1, "status": 1 });
db.workflows.createIndex({ "createdAt": -1 });

// Analytics-specific indexes
db.workflows.createIndex({ "analytics.totalTriggers": -1 });
db.workflows.createIndex({ "analytics.lastTriggered": -1 });
```

## ⚡ Performance Features

### **Event Processing Performance**
- **Batch Processing**: Events batched every 2 seconds on frontend
- **Bulk Operations**: Single MongoDB bulkWrite for multiple workflows
- **Memory Efficiency**: Only 5 fields processed per event (vs 17+ before)
- **No Individual Events**: Only aggregated counters stored

### **Database Performance**
- **Embedded Analytics**: No separate analytics collections
- **Atomic Updates**: MongoDB $inc operations for counters
- **Optimized Queries**: Proper indexing for common access patterns
- **Virtual Properties**: Computed fields reduce storage needs

### **Scaling Characteristics**
| Load Level | Performance | Database Calls | Memory Usage |
|------------|-------------|----------------|--------------|
| 1K events/min | Excellent | 1 per batch | Low |
| 10K events/min | Excellent | 1 per batch | Low |
| 100K events/min | Good | 1 per batch | Medium |

## 🔧 Configuration

### **Environment Variables**
```bash
# Server Configuration
PORT=3003
NODE_ENV=production

# Database
MONGODB_URI=mongodb://localhost:27017/workflows

# Redis (for queues and caching)
REDIS_URL=redis://localhost:6379

# Queue Configuration
QUEUE_CONCURRENCY=5
QUEUE_RETRY_ATTEMPTS=3
QUEUE_RETRY_DELAY=1000

# Analytics Configuration
BATCH_SIZE=1000
BATCH_TIMEOUT=2000
MAX_EVENTS_PER_BATCH=100

# Security
JWT_SECRET=your-secure-secret
CORS_ORIGIN=https://yourdomain.com
```

### **Queue Configuration**
```javascript
// Queue settings in queueService.js
const workflowQueue = new Queue('workflow execution', {
  redis: redisClient,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 1000,
    removeOnFail: 200,
    timeout: 60_000
  }
});

const analyticsQueue = new Queue('analytics processing', {
  redis: redisClient,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 500 },
    removeOnComplete: 2000,
    removeOnFail: 300,
    timeout: 30_000
  }
});
```

## 🚀 Deployment

### **Docker Configuration**
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
EXPOSE 3003

CMD ["npm", "start"]
```

### **Docker Compose**
```yaml
version: '3.8'
services:
  workflow-service:
    build: ./services/workflows
    ports:
      - "3003:3003"
    environment:
      - MONGODB_URI=mongodb://mongodb:27017/workflows
      - REDIS_URL=redis://redis:6379
      - NODE_ENV=production
    depends_on:
      - mongodb
      - redis
    
  mongodb:
    image: mongo:6
    volumes:
      - mongodb_data:/data/db
    
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  mongodb_data:
  redis_data:
```

### **Health Checks**
```javascript
// Health check endpoint
GET /api/v1/health

// Response
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "services": {
    "mongodb": "connected",
    "redis": "connected",
    "queues": "active"
  },
  "metrics": {
    "uptime": 86400,
    "memory": "45.2 MB",
    "cpu": "2.1%"
  }
}
```

## 📊 Monitoring & Observability

### **Key Metrics to Monitor**
- **Request Rate**: HTTP requests per second
- **Response Time**: API endpoint latency
- **Error Rate**: Failed requests percentage
- **Queue Depth**: Pending jobs in Redis queues
- **Database Performance**: MongoDB operation times
- **Memory Usage**: Node.js heap usage
- **Event Processing Rate**: Analytics events per second

### **Logging**
```javascript
// Structured logging with Winston
{
  "level": "info",
  "message": "Processed workflow events",
  "timestamp": "2024-01-15T10:30:00Z",
  "metadata": {
    "eventsProcessed": 50,
    "workflowsUpdated": 5,
    "processingTime": 45
  }
}
```

### **Alerts**
- **High Error Rate**: > 5% error rate for 5 minutes
- **Queue Backup**: > 1000 pending jobs
- **Database Slow Queries**: > 1 second query time
- **Memory Usage**: > 80% heap usage
- **Service Down**: Health check failures

---

**Need help?** Check the [API Reference](./API_REFERENCE.md) or [System Architecture](./SYSTEM_ARCHITECTURE_OVERVIEW.md) for more details.
