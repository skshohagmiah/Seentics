# Seentics System Architecture

A comprehensive overview of the Seentics microservices architecture, combining the API Gateway, User Service, Analytics Service, and Workflows Service into a cohesive platform for intelligent website automation.

## 🏗️ System Overview

Seentics is a microservices platform with three core services and an optional API Gateway. Services communicate over HTTP and use MongoDB, TimescaleDB, and Redis for storage and queues. The frontend (Next.js) consumes the Gateway or services directly in development.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              SEENTICS PLATFORM                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐             │
│  │   Frontend      │    │   tracker.js    │    │  Mobile Apps    │             │
│  │   (Next.js)     │    │   (Vanilla JS)  │    │   (Future)      │             │
│  └─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘             │
│            │                      │                      │                     │
│            └──────────────────────┼──────────────────────┘                     │
│                                   │                                            │
├───────────────────────────────────┼────────────────────────────────────────────┤
│                                   ▼                                            │
│                        ┌─────────────────┐                                     │
│                        │   API GATEWAY   │                                     │
│                        │   (Go/Gin)      │                                     │
│                        │   Port: 8080    │                                     │
│                        └─────────┬───────┘                                     │
│    ┌─────────────────────────────┼─────────────────────────────┐                │
│    │                             │                             │                │
│    ▼                             ▼                             ▼                │
│ ┌─────────────┐            ┌─────────────┐            ┌─────────────┐           │
│ │USER SERVICE │            │ ANALYTICS   │            │ WORKFLOWS   │           │
│ │ (Node.js)   │            │ (Go)        │            │ (Node.js)   │           │
│ │ Port: 3001  │            │ Port: 3002  │            │ Port: 3003  │           │
│ │             │            │             │            │             │           │
│ │ - Auth      │            │ - Events    │            │ - Execution │           │
│ │ - Users     │            │ - Metrics   │            │ - Analytics │           │
│ │ - Websites  │            │ - Reports   │            │             │           │
│ │ - Billing   │            │             │            │             │           │
│ └─────────────┘            └─────────────┘            └─────────────┘           │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                              DATA LAYER                                        │
│                                                                                 │
│ ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐    │
│ │  MongoDB    │     │TimescaleDB  │     │  MongoDB    │     │   Redis     │    │
│ │             │     │             │     │             │     │             │    │
│ │ Users       │     │ Events      │     │ Workflows   │     │ Cache       │    │
│ │ Websites    │     │ Sessions    │     │ Analytics   │     │ Queues      │    │
│ │ Billing     │     │ Analytics   │     │             │     │ Sessions    │    │
│ └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────┘
## 🚪 API Gateway (Go) - Port 8080 (optional)

The API Gateway serves as the single entry point for all client requests, providing routing, authentication, rate limiting, and caching.

### **Core Responsibilities**
- **Request Routing**: Intelligent routing to appropriate microservices
- **Authentication**: JWT validation and user context injection
- **Authorization**: Domain validation for public endpoints, website ownership for private endpoints
- **Rate Limiting**: In-memory rate limiting with different strategies per user type
- **Caching**: In-memory response caching and validation caching
- **Monitoring**: Request logging, metrics collection, and health checks

### **Key Features**
- **In-Memory Validation Cache**: Caches user-website relationships and domain mappings
- **Smart Rate Limiting**: Different limits for authenticated vs anonymous users
- **Response Caching**: Caches GET responses with context-aware keys
- **Health Monitoring**: Monitors all downstream services

### **Route Structure**
```
Public Routes (Domain Validated):
├── GET  /api/v1/workflows/site/:siteId/active → Workflows Service
├── POST /api/v1/analytics/event               → Analytics Service
└── POST /api/v1/analytics/event/batch         → Analytics Service

Authenticated Routes (JWT Required):
├── /api/v1/user/*                        → User Service
├── /api/v1/analytics/dashboard/*         → Analytics Service (+ Website Validation)
└── /api/v1/workflows/*                   → Workflows Service (+ Website Validation)

Webhook Routes:
└── POST /api/v1/webhooks/lemon-squeezy   → User Service

Cache Management:
├── DELETE /api/v1/cache/user/:userId
├── DELETE /api/v1/cache/website/:websiteId
└── GET    /api/v1/cache/stats
```

### **Middleware Stack**
1. **Request ID**: Unique request tracking
2. **Logging**: Structured request/response logging
3. **Recovery**: Panic recovery with logging
4. **CORS**: Cross-origin resource sharing
5. **Metrics**: Prometheus metrics collection
6. **Rate Limiting**: In-memory token bucket algorithm
7. **Authentication**: JWT validation (where required)
8. **Domain Validation**: Origin validation for public endpoints
9. **Website Validation**: Ownership validation for private endpoints
10. **Response Caching**: GET request caching

## 👤 User Service (Node.js/Express) - Port 3001

The User Service handles all user-related operations, authentication, website management, and subscription billing.

### **Core Responsibilities**
- **User Management**: Registration, login, profile management
- **Authentication**: JWT token generation and validation
- **OAuth Integration**: Google and GitHub OAuth without Passport.js
- **Website Management**: CRUD operations for user websites
- **Subscription Management**: Lemon Squeezy integration and usage tracking
- **Security**: Password hashing, email verification, account security

### **Database Schema (MongoDB)**
```javascript
// Users Collection
{
  _id: ObjectId,
  email: String,
  password: String, // bcrypt hashed
  name: String,
  avatar: String,
  provider: String, // 'local', 'google', 'github'
  providerId: String,
  emailVerified: Boolean,
  subscription: {
    plan: String, // 'free', 'standard', 'pro', 'enterprise', 'lifetime'
    status: String, // 'active', 'cancelled', 'expired'
    lemonSqueezyId: String,
    currentPeriodEnd: Date,
    usage: {
      websites: Number,
      workflows: Number,
      monthlyEvents: Number
    }
  },
  createdAt: Date,
  updatedAt: Date
}

// Websites Collection
{
  _id: ObjectId,
  userId: ObjectId,
  name: String,
  domain: String,
  domains: [String], // Multiple allowed domains
  siteId: String, // Public identifier for tracking
  isActive: Boolean,
  settings: {
    trackingEnabled: Boolean,
    allowedOrigins: [String]
  },
  createdAt: Date,
  updatedAt: Date
}
```

### **API Endpoints**

#### Authentication
```
POST /api/v1/auth/register        - Register new user
POST /api/v1/auth/login          - Login user  
POST /api/v1/auth/google         - Google OAuth
POST /api/v1/auth/github         - GitHub OAuth
POST /api/v1/auth/refresh        - Refresh JWT token
POST /api/v1/auth/logout         - Logout user
GET  /api/v1/auth/me             - Get current user
```

#### User Management
```
GET  /api/v1/users/profile       - Get user profile
PUT  /api/v1/users/profile       - Update user profile
PUT  /api/v1/users/password      - Change password
DELETE /api/v1/users/account     - Delete account
```

#### Website Management
```
GET  /api/v1/websites                    - Get all user websites
GET  /api/v1/websites/:id                - Get specific website
GET  /api/v1/websites/by-site-id/:siteId - Get website by siteId (internal)
POST /api/v1/websites                    - Create new website
PUT  /api/v1/websites/:id                - Update website
DELETE /api/v1/websites/:id              - Delete website
POST /api/v1/websites/:id/verify         - Verify website ownership
```

#### Subscription Management
```
GET  /api/v1/subscriptions/current       - Get current subscription
GET  /api/v1/subscriptions/usage         - Get usage statistics
POST /api/v1/subscriptions/check-limit   - Check usage limits
POST /api/v1/subscriptions/increment-usage - Increment usage
```

#### Webhooks
```
POST /api/v1/user/webhooks/lemon-squeezy - Lemon Squeezy webhook handler
```

### **Subscription Plans**
- **Free**: 1 website, 5 workflows, 10K monthly events
- **Standard**: 5 websites, 25 workflows, 100K monthly events  
- **Pro**: 20 websites, 100 workflows, 500K monthly events
- **Enterprise**: 100 websites, 500 workflows, 2M monthly events
- **Lifetime**: 50 websites, 200 workflows, 1M monthly events

## 📊 Analytics Service (Go) - Port 3002

The Analytics Service provides high-performance event tracking and analytics using TimescaleDB for time-series data optimization.

> 📚 **For detailed documentation, see [Analytics Service Documentation](./ANALYTICS_SERVICE.md)**

### **Core Responsibilities**
- **Event Ingestion**: High-throughput batch processing of website events
- **Real-time Analytics**: Current day analytics with sub-second response times
- **Historical Analytics**: Pre-aggregated data for multi-day analysis
- **Session Tracking**: Advanced session management and bounce rate calculation
- **Performance Metrics**: Comprehensive website performance analytics

### **Database Schema (TimescaleDB)**
```sql
-- Events table for tracking user interactions
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id VARCHAR(255) NOT NULL,
    visitor_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL DEFAULT 'pageview',
    page VARCHAR(500) NOT NULL,
    referrer TEXT,
    user_agent TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    properties JSONB,
    time_on_page INTEGER,
    utm_source VARCHAR(255),
    utm_medium VARCHAR(255),
    utm_campaign VARCHAR(255),
    country VARCHAR(100),
    city VARCHAR(100),
    browser VARCHAR(100),
    os VARCHAR(100),
    device VARCHAR(100),
    is_bot BOOLEAN DEFAULT FALSE,
    is_new_user BOOLEAN DEFAULT FALSE
);

-- Daily Summaries (Pre-aggregated historical data)
CREATE TABLE daily_summaries (
    id SERIAL PRIMARY KEY,
    website_id VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    page_views INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    sessions INTEGER DEFAULT 0,
    bounce_rate DECIMAL(5,2) DEFAULT 0,
    avg_session_duration INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    revenue DECIMAL(12,2) DEFAULT 0,
    top_pages JSONB,
    top_referrers JSONB,
    top_countries JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session Tracking
CREATE TABLE session_tracking (
    session_id VARCHAR(255) PRIMARY KEY,
    website_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255),
    first_page VARCHAR(500),
    last_page VARCHAR(500),
    page_count INTEGER DEFAULT 1,
    duration INTEGER DEFAULT 0,
    is_bounce BOOLEAN DEFAULT true,
    referrer VARCHAR(500),
    country VARCHAR(100),
    browser VARCHAR(100),
    device VARCHAR(100),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);
```

### **Batch Processing System**
- **High Throughput**: Processes 10,000+ events/second
- **Configurable Batching**: Default 1000 events per batch, 5-second timeout
- **Worker Pool**: 10 parallel processing workers
- **Graceful Shutdown**: Preserves data during restarts

### **API Endpoints**

#### Event Tracking
```
POST /api/v1/events/track              - Single website event tracking (pageviews, etc.)
POST /api/v1/events/track/batch        - Batch event tracking (high performance)
```

#### Dashboard Analytics
```
GET /api/v1/analytics/{websiteId}/dashboard       - Complete dashboard data
GET /api/v1/analytics/{websiteId}/realtime        - Real-time analytics
GET /api/v1/analytics/{websiteId}/top-pages       - Top pages analytics
```

#### Detailed Analytics
```
GET /api/v1/analytics/{websiteId}/top-pages       - Top pages with bounce rates
GET /api/v1/analytics/{websiteId}/top-referrers   - Top referrer sources  
GET /api/v1/analytics/{websiteId}/top-countries   - Geographic analytics
GET /api/v1/analytics/{websiteId}/top-browsers    - Browser analytics
GET /api/v1/analytics/{websiteId}/top-devices     - Device analytics
```

#### Time-based Analytics
```
GET /api/v1/analytics/{websiteId}/hourly-stats   - Hourly traffic patterns
GET /api/v1/analytics/{websiteId}/daily-stats    - Daily trend analysis
```

#### Advanced Analytics
```
GET /api/v1/funnels/{websiteId}                 - Funnel analysis and conversion tracking
GET /api/v1/funnels/{funnelId}/performance      - Funnel performance metrics
```

### **Performance Features**
- **TimescaleDB Hypertables**: Optimized time-series storage
- **Automatic Compression**: Data compression after 1 day
- **Smart Retention**: Automatic cleanup of old raw data (30 days default)
- **Connection Pooling**: Efficient database connections
- **Optimized Indexes**: Fast queries across all endpoints

## ⚡ Workflows Service (Node.js/Express) - Port 3003

The Workflows Service manages automation workflows, execution, and workflow-specific analytics.

### **Core Responsibilities**
- **Workflow Management**: CRUD operations for automation workflows
- **Real-time Execution**: Process workflow triggers and actions
- **Workflow Analytics**: Performance metrics and tracking
- **Activity Logging**: Detailed execution logs
- **Queue Processing**: Scalable job processing with Redis/Bull

### **Database Schema (MongoDB)**
```javascript
// Workflows Collection
{
  _id: ObjectId,
  userId: ObjectId,
  websiteId: ObjectId,
  siteId: String,
  name: String,
  description: String,
  status: String, // 'active', 'paused', 'draft'
  nodes: [{
    id: String,
    type: String, // 'trigger', 'condition', 'action'
    position: { x: Number, y: Number },
    data: {
      iconName: String,
      title: String,
      type: String,
      color: String,
      settings: Object
    }
  }],
  edges: [{
    id: String,
    source: String,
    target: String,
    animated: Boolean
  }],
  analytics: {
    totalTriggers: Number,
    totalCompletions: Number,
    completionRate: Number,
    lastTriggered: Date
  },
  createdAt: Date,
  updatedAt: Date
}

// Workflow Events Collection
{
  _id: ObjectId,
  workflowId: ObjectId,
  websiteId: ObjectId,
  sessionId: String,
  eventType: String, // 'triggered', 'completed', 'failed'
  nodeId: String,
  nodeType: String,
  data: Object,
  timestamp: Date
}

// Workflow Activity Collection
{
  _id: ObjectId,
  workflowId: ObjectId,
  sessionId: String,
  action: String,
  details: Object,
  status: String, // 'success', 'failed', 'pending'
  executionTime: Number,
  timestamp: Date
}
```

### **API Endpoints**

#### Workflow Management
```
GET    /api/v1/workflows                    - Get all workflows (query: status, siteId)
GET    /api/v1/workflows/:id                - Get specific workflow
POST   /api/v1/workflows                    - Create workflow
PUT    /api/v1/workflows/:id                - Update workflow
DELETE /api/v1/workflows/:id                - Delete workflow
```

#### Workflow Analytics
```
GET /api/v1/workflows/:id/analytics         - Get workflow analytics
GET /api/v1/workflows/:id/activity          - Get workflow activity log
GET /api/v1/workflows/:id/chart             - Get workflow performance chart
GET /api/v1/workflows/:id/nodes             - Get workflow node performance
```

#### Workflow Execution
```
POST /api/v1/execution/action                - Execute workflow action (server-side)
GET  /api/v1/execution/status/:jobId         - Get execution status
GET  /api/v1/execution/logs/:workflowId      - Get execution logs
```

#### Analytics Tracking (for workflows)
```
POST /api/v1/analytics/track                 - Track workflow event (triggered, completed)
GET  /api/v1/analytics/workflow/:workflowId  - Get workflow analytics
GET  /api/v1/analytics/workflows/summary     - Get workflow summaries
```

### **Queue System (Redis/Bull)**
- **workflow-execution**: Handles server-side action execution
- **workflow-analytics**: Processes workflow-specific tracking events
- **email-queue**: Manages email sending for workflow actions
- **webhook-queue**: Handles webhook execution for workflows

## 🔄 Data Flow & Integration

### **1. User Registration & Website Setup**
```
Frontend → API Gateway → User Service → MongoDB
                     ↓
              Cache user data in Gateway
```

### **2. Website Tracking Setup**
```
Frontend → API Gateway → User Service → Add website record
                     ↓
              Generate siteId and tracking code
                     ↓
              Cache domain mappings in Gateway
```

### **3. Event Tracking Flow**
```
tracker.js → API Gateway (domain validation) → Analytics Service → TimescaleDB
                     ↓                                    ↓
              Check cache for                    Batch processing
              domain validity                    (1000 events/batch)
```

### **4. Workflow Execution Flow**
```
tracker.js → API Gateway → Workflows Service → Execute actions
                     ↓              ↓
              Domain validation    Queue jobs in Redis
                     ↓              ↓
              Cache workflow       Log activity in MongoDB
              configurations
```

### **5. Dashboard Analytics Flow**
```
Frontend → API Gateway → Analytics Service → Query TimescaleDB
              ↓                    ↓
       Cache responses      Real-time aggregation
              ↓                    ↓
       Return cached data   Return fresh data
```

## 🛡️ Security Architecture

### **Authentication Flow**
1. **User Login**: User Service generates JWT tokens
2. **Token Validation**: API Gateway validates all requests
3. **Context Injection**: Gateway injects user context into service requests
4. **Service Trust**: Internal services trust Gateway-validated requests

### **Authorization Layers**
1. **Public Endpoints**: Domain validation against website settings
2. **User Endpoints**: JWT validation and user context
3. **Website Endpoints**: Website ownership validation
4. **Admin Endpoints**: Role-based access control

### **Data Protection**
- **Encryption**: All passwords bcrypt hashed
- **JWT Security**: Short-lived access tokens, long-lived refresh tokens
- **Database Security**: Connection encryption, parameterized queries
- **Rate Limiting**: Prevents abuse and DDoS attacks

## 📈 Performance & Scalability

### **Caching Strategy**
- **Gateway Cache**: In-memory validation and response caching
- **Database Optimization**: Proper indexing and query optimization
- **CDN Integration**: Static asset delivery optimization

### **Horizontal Scaling**
- **Stateless Services**: All services are stateless and horizontally scalable
- **Load Balancing**: API Gateway can be load balanced
- **Database Scaling**: Read replicas for analytics queries

### **Performance Metrics**
- **Event Ingestion**: 10,000+ events/second
- **API Response Time**: <100ms for cached responses
- **Dashboard Load Time**: <2 seconds for 30-day analytics
- **Real-time Updates**: <5 second refresh intervals

## 🔧 Configuration & Deployment

### **Environment Variables**
Each service requires specific environment configuration:

#### API Gateway
```env
PORT=8080
USER_SERVICE_URL=http://user-service:3001
ANALYTICS_SERVICE_URL=http://analytics-service:3002
WORKFLOW_SERVICE_URL=http://workflows-service:8083
JWT_SECRET=your-jwt-secret
RATE_LIMIT_PER_MINUTE=100
CACHE_TTL=300
```

#### User Service
```env
PORT=8081
MONGODB_URI=mongodb://localhost:27017/seentics_users
JWT_SECRET=your-jwt-secret
GOOGLE_CLIENT_ID=your-google-client-id
LEMON_SQUEEZY_API_KEY=your-lemon-squeezy-key
```

#### Analytics Service
```env
PORT=3002
DATABASE_URL=postgresql://user:pass@localhost:5432/analytics
BATCH_SIZE=1000
BATCH_TIMEOUT=5s
WORKER_COUNT=10
```

#### Workflows Service
```env
PORT=8083
MONGODB_URI=mongodb://localhost:27017/seentics_workflows
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-jwt-secret
```

### **Docker Deployment**
```yaml
version: '3.8'
services:
  api-gateway:
    build: ./api-gateway
    ports: ["8080:8080"]
    depends_on: [user-service, analytics-service, workflows-service]
    
  user-service:
    build: ./user-service
    ports: ["81:81"]
    depends_on: [mongodb]
    
  analytics-service:
    build: ./analytics-service
    ports: ["82:82"]
    depends_on: [timescaledb]
    
  workflows-service:
    build: ./workflows-service
    ports: ["83:83"]
    depends_on: [mongodb, redis]
```

## 🔍 Monitoring & Observability

### **Health Checks**
- **Gateway Health**: Monitors all downstream services
- **Service Health**: Individual service health endpoints
- **Database Health**: Connection and query performance monitoring

### **Logging Strategy**
- **Structured Logging**: JSON format for all services
- **Request Tracing**: Unique request IDs across service calls
- **Error Tracking**: Comprehensive error logging and alerting

### **Metrics Collection**
- **Prometheus Integration**: Custom metrics for all services
- **Performance Metrics**: Response times, throughput, error rates
- **Business Metrics**: User registrations, workflow executions, event volume

## 🚀 Development Workflow

### **Local Development**
1. Start all databases (MongoDB, TimescaleDB, Redis)
2. Start services in dependency order
3. Use Docker Compose for full environment
4. Frontend connects to API Gateway on port 8080

### **Testing Strategy**
- **Unit Tests**: Individual service testing
- **Integration Tests**: Service-to-service communication
- **End-to-End Tests**: Full workflow testing
- **Load Testing**: Performance and scalability validation

### **Deployment Pipeline**
1. **Code Commit**: Trigger CI/CD pipeline
2. **Testing**: Run all test suites
3. **Building**: Create Docker images
4. **Deployment**: Rolling deployment to production
5. **Monitoring**: Health checks and performance monitoring

This architecture provides a robust, scalable foundation for the Seentics platform, enabling intelligent website automation with comprehensive analytics and user management capabilities.
