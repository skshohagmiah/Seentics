# Seentics - Open Source Analytics & Automation Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
[![MVP Ready](https://img.shields.io/badge/Status-MVP%20Ready-brightgreen.svg)](https://github.com/seentics/seentics)
[![Docker](https://img.shields.io/badge/Docker-Compose%20Ready-blue.svg)](https://docs.docker.com/compose/)

**🚀 Production-ready open-source platform** combining real-time analytics, visual workflow automation, and intelligent user behavior tracking. Built with modern microservices architecture for high performance and scalability.

## 🌟 **Open Source First**

Seentics is designed as a **fully-featured open source platform** with unlimited usage:

- ✅ **Unlimited everything** - websites, workflows, funnels, events
- ✅ **No usage restrictions** or billing limitations  
- ✅ **Complete self-hosted control** over your data
- ✅ **All core features** - analytics, workflows, automation
- ✅ **Production-ready** for any scale of deployment

> **Note**: We also offer a hosted cloud service at [seentics.com](https://seentics.com) for those who prefer a managed solution. The codebase includes cloud mode features, but these are reserved for our official hosted service only.

## ✨ **What Makes Seentics Special**

- **🎯 Visual Workflow Builder**: Drag-and-drop automation with 50+ triggers, conditions, and actions
- **📊 Real-Time Analytics**: High-performance event processing (10,000+ events/sec) with TimescaleDB
- **🔄 Intelligent Automation**: React to user behavior instantly with client and server-side actions
- **🏗️ Microservices Architecture**: Scalable, maintainable, and production-ready
- **🛡️ Privacy-First**: Built-in GDPR compliance and data privacy controls
- **🚀 Self-Hosted**: Complete control over your data and infrastructure

## 🌟 **Core Features**

### 🎯 **Visual Workflow Builder**
- **Drag-and-Drop Interface**: Intuitive node-based workflow creation with real-time preview
- **Smart Triggers**: Page views, element clicks, funnel events, time spent, exit intent, scroll depth
- **Advanced Conditions**: URL patterns, traffic sources, visitor segments, device types, geolocation
- **Powerful Actions**: Dynamic modals, banners, emails, webhooks, redirects, custom JavaScript
- **Real-time Testing**: Live workflow preview and debugging tools

### 📊 **High-Performance Analytics**
- **Real-Time Processing**: 10,000+ events/second with TimescaleDB optimization
- **Comprehensive Tracking**: Page views, custom events, user sessions, conversion funnels
- **Advanced Dashboards**: Interactive charts, real-time metrics, custom date ranges
- **Funnel Analytics**: Multi-step conversion tracking with drop-off analysis
- **Privacy Compliant**: GDPR-ready with data retention controls and user consent management

### ⚡ **Intelligent Automation**
- **Instant Response**: Sub-100ms trigger-to-action execution
- **Multi-Channel Actions**: Client-side UI changes, server-side integrations, email campaigns
- **Smart Targeting**: Behavioral segmentation and personalized user experiences
- **Scalable Execution**: Distributed processing with Redis queuing and caching

### 🛡️ **Enterprise-Ready Security**
- **JWT Authentication**: Secure token-based auth with refresh token support
- **OAuth Integration**: Google and GitHub single sign-on
- **API Gateway**: Centralized routing, rate limiting, and request validation
- **Data Privacy**: Built-in GDPR compliance tools and data export capabilities

<div align="center">

### 📊 **System Architecture Diagram**

<img src="./docs/simplified_architecture_diagram.svg" alt="Seentics System Architecture" width="100%" style="max-width: 1000px;">

</div>

### **Service Breakdown**

| Service | Technology | Port | Purpose |
|---------|------------|------|---------|
| **API Gateway** | Go/Gin | 8080 | Request routing, auth, caching, rate limiting |
| **User Service** | Node.js/Express | 3001 | Authentication, user management, billing |
| **Analytics Service** | Go | 3002 | Event tracking, analytics, reporting |
| **Workflows Service** | Node.js/Express | 3003 | Workflow management, execution, automation |
| **Frontend** | Next.js/React | 3000 | User interface and dashboard |

### **Data Storage**

| Database | Purpose | Data Type |
|----------|---------|-----------|
| **MongoDB** | User accounts, websites, workflows | Document storage |
| **TimescaleDB** | Analytics events, metrics | Time-series data |
| **Redis** | Caching, queues, sessions | In-memory storage |

## 🚀 **Quick Start**

### **Prerequisites**
- **Node.js** 18+ 
- **Go** 1.21+
- **Docker** & Docker Compose
- **Git**

### **1. Clone the Repository**
```bash
git clone https://github.com/skshohagmiah/Seentics
cd seentics
```

### **2. Start Infrastructure Services**
```bash
# Start databases and Redis
docker compose up -d mongodb timescaledb redis

# Wait for services to be ready (check with docker compose ps)
```

### **3. Configure Environment Variables**
```bash
# Copy environment templates
cp .env.example .env
cp frontend/.env.example frontend/.env.local

# The platform runs in open source mode by default
# No additional configuration needed for full functionality

# Edit .env files with your configuration
# See Configuration section below for required variables
```

### **4. Start All Services**
```bash
# Option 1: Start all services with Docker Compose (Recommended)
docker compose up -d

# Option 2: Start services individually
cd services/users && npm install && npm run dev
cd services/analytics && go mod tidy && go run main.go
cd services/workflows && npm install && npm run dev
```

### **5. Start Frontend**
```bash
cd frontend
npm install
npm run dev
```

### **6. Access the Application**
- **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
- **API Gateway**: [http://localhost:8080](http://localhost:8080)
- **User Service**: [http://localhost:3001](http://localhost:3001)
- **Analytics Service**: [http://localhost:3002](http://localhost:3002)
- **Workflows Service**: [http://localhost:3003](http://localhost:3003)

### **7. Create Your First Workflow**
1. **Sign up** at [http://localhost:3000](http://localhost:3000)
2. **Add a website** to start tracking
3. **Install tracking code** on your website
4. **Create workflows** using the visual builder
5. **Monitor analytics** and workflow performance

## ⚙️ **Configuration**

### **Environment Variables**

#### **API Gateway** (`.env`)
```bash
PORT=8080
USER_SERVICE_URL=http://user-service:3001
ANALYTICS_SERVICE_URL=http://analytics-service:3002
WORKFLOW_SERVICE_URL=http://workflows-service:3003
JWT_SECRET=your-secure-jwt-secret
RATE_LIMIT_PER_MINUTE=100
CACHE_TTL=300
```

#### **User Service** (`.env`)
```bash
PORT=3001
MONGODB_URI=mongodb://localhost:27017/seentics_users
JWT_SECRET=your-secure-jwt-secret
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GITHUB_CLIENT_ID=your-github-oauth-client-id
```

#### **Analytics Service** (`.env`)
```bash
PORT=3002
DATABASE_URL=postgresql://user:pass@localhost:5432/analytics
BATCH_SIZE=1000
BATCH_TIMEOUT=5s
WORKER_COUNT=10
LOG_LEVEL=info
```

#### **Workflows Service** (`.env`)
```bash
PORT=3003
MONGODB_URI=mongodb://localhost:27017/seentics_workflows
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secure-jwt-secret
```

### **Database Setup**
```bash
# MongoDB (Users & Workflows)
docker run -d --name mongodb -p 27017:27017 mongo:latest

# TimescaleDB (Analytics)
docker run -d --name timescaledb -p 5432:5432 \
  -e POSTGRES_DB=analytics \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=pass \
  timescale/timescaledb:latest-pg15

# Redis (Caching & Queues)
docker run -d --name redis -p 6379:6379 redis:latest
```

## 📚 **API Overview**

### **Public Endpoints** (No Authentication Required)
```
# Analytics Tracking
POST /api/v1/analytics/event                  - Track single event
POST /api/v1/analytics/event/batch            - Batch event tracking

# Workflow Tracking  
GET  /api/v1/workflows/active                 - Get active workflows for site
POST /api/v1/workflows/execution/action       - Execute workflow actions

# Funnel Tracking
GET  /api/v1/funnels/active                   - Get active funnels for site
POST /api/v1/funnels/track                    - Track funnel events
```

### **Authenticated Endpoints** (JWT Required)
```
# Authentication
POST /api/v1/user/auth/login                  - User login
POST /api/v1/user/auth/register               - User registration
POST /api/v1/user/auth/google                 - Google OAuth login
GET  /api/v1/user/auth/me                     - Get current user

# Website Management
GET  /api/v1/user/websites                    - Get user websites
POST /api/v1/user/websites                    - Create website
PUT  /api/v1/user/websites/:id                - Update website
DELETE /api/v1/user/websites/:id              - Delete website

# Analytics Dashboard
GET  /api/v1/analytics/dashboard/:websiteId   - Dashboard overview
GET  /api/v1/analytics/top-pages/:websiteId   - Top pages report
GET  /api/v1/analytics/hourly-stats/:websiteId - Hourly statistics
GET  /api/v1/analytics/funnel-analytics/:websiteId - Funnel performance

# Workflow Management
GET  /api/v1/workflows                        - Get user workflows
POST /api/v1/workflows                        - Create workflow
PUT  /api/v1/workflows/:id                    - Update workflow
DELETE /api/v1/workflows/:id                  - Delete workflow
GET  /api/v1/workflows/:id/analytics          - Workflow performance
```

## 🔧 **Development Workflow**

### **Local Development**
1. **Start Infrastructure**: `docker compose up -d`
2. **Start Services**: Each service can be run individually for development
3. **Frontend Development**: Next.js with hot reloading
4. **API Testing**: Use Postman or curl for API testing

### **Testing**
```bash
# Run all tests
npm run test

# Run specific service tests
cd services/users && npm test
cd services/analytics && go test ./...
cd services/workflows && npm test

# Frontend tests
cd frontend && npm test
```

### **Code Quality**
- **ESLint** for JavaScript/TypeScript
- **Go fmt** and **golangci-lint** for Go
- **Prettier** for code formatting
- **Husky** for pre-commit hooks

## 📊 **Performance & Monitoring**

### **Health Checks**
- **Service Health**: `/health` endpoint on each service
- **Readiness Checks**: `/ready` endpoint for deployment readiness
- **Metrics**: Prometheus metrics on `/metrics` endpoints

### **Performance Metrics**
- **Event Processing**: 10,000+ events/second with TimescaleDB optimization
- **API Response Time**: <100ms for cached responses via Redis
- **Dashboard Load Time**: <2 seconds for 30-day analytics with 1M+ events
- **Real-time Updates**: <5 second refresh intervals
- **Workflow Execution**: Sub-100ms trigger-to-action response time
- **Concurrent Users**: Supports 1000+ simultaneous dashboard users

### **Monitoring Tools**
- **Prometheus**: Metrics collection
- **Grafana**: Dashboard visualization
- **Jaeger**: Distributed tracing
- **ELK Stack**: Log aggregation

## 🏢 **Cloud Mode (Internal Use Only)**

> **⚠️ Important**: The cloud mode features are reserved for our official hosted service at [seentics.com](https://seentics.com). These features are included in the codebase for transparency but are not intended for third-party commercial use.

For developers interested in the implementation, cloud mode can be enabled with:

```bash
# Backend (.env)
CLOUD_FEATURES_ENABLED=true

# Frontend (.env.local)  
NEXT_PUBLIC_CLOUD_FEATURES_ENABLED=true

# Additional billing configuration (requires Stripe setup)
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

This adds subscription tiers, usage limits, billing pages, and team management features for our managed service.

## 🚀 **Deployment**

### **Production Deployment**
```bash
# Build Docker images
docker compose -f docker-compose.prod.yml build

# Deploy to production
docker compose -f docker-compose.prod.yml up -d

# Scale services
docker compose -f docker-compose.prod.yml up -d --scale analytics-service=3
```

### **Environment-Specific Configs**
- **Development**: `docker-compose.yml`
- **Staging**: `docker-compose.staging.yml`
- **Production**: `docker-compose.prod.yml`

### **Kubernetes Deployment**
```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n seentics
```

## 🤝 **Contributing**

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### **Ways to Contribute**
- 🐛 **Report Bugs**: Create detailed bug reports
- 💡 **Suggest Features**: Propose new functionality
- 📝 **Improve Docs**: Enhance documentation
- 🔧 **Code Changes**: Submit pull requests
- 🧪 **Write Tests**: Add test coverage
- 🌍 **Localization**: Help with translations

### **Development Setup**
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Commit: `git commit -m 'Add amazing feature'`
5. Push: `git push origin feature/amazing-feature`
6. Open a Pull Request

## 📚 **Documentation**

- [**System Architecture**](./docs/SYSTEM_ARCHITECTURE_OVERVIEW.md) - Complete system overview
- [**Analytics Service**](./docs/ANALYTICS_SERVICE.md) - Analytics service documentation
- [**API Reference**](./docs/API_REFERENCE.md) - API endpoints and usage
- [**Features Guide**](./docs/features.md) - Detailed feature descriptions
- [**User Management**](./docs/USER_MANAGEMENT_MICROSERVICE.md) - User service details
- [**Workflow Engine**](./docs/WORKFLOW_ENGINE_MICROSERVICE.md) - Workflow service details

## 🆘 **Support & Community**

- 📖 [**Documentation**](./docs/) - Comprehensive guides
- 🐛 [**Issues**](https://github.com/seentics/seentics/issues) - Bug reports and feature requests
- 💬 [**Discussions**](https://github.com/seentics/seentics/discussions) - Community discussions
- 📧 [**Email Support**](mailto:support@seentics.com) - Direct support
- 🐦 [**Twitter**](https://twitter.com/seentics) - Latest updates

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## ⭐ **Star History**

If you find this project helpful, please give it a star! ⭐

## 🎯 **Use Cases**

### **E-commerce**
- **Cart Abandonment**: Trigger exit-intent modals with discount codes
- **Product Recommendations**: Show personalized product suggestions based on browsing behavior
- **Conversion Optimization**: A/B test different checkout flows and CTAs

### **SaaS & Tech**
- **User Onboarding**: Guide new users through feature discovery workflows
- **Feature Adoption**: Trigger in-app messages for unused features
- **Churn Prevention**: Identify at-risk users and trigger retention campaigns

### **Content & Media**
- **Newsletter Signups**: Smart popups based on reading time and scroll depth
- **Content Personalization**: Show relevant articles based on user interests
- **Engagement Tracking**: Monitor content performance and user engagement patterns

### **Lead Generation**
- **Smart Forms**: Progressive profiling based on user behavior
- **Exit Intent**: Capture leaving visitors with targeted offers
- **Nurture Campaigns**: Automated email sequences based on website interactions

## 🌍 **Community & Support**

- **📖 Documentation**: Comprehensive guides and API references
- **🐛 GitHub Issues**: Bug reports and feature requests
- **💬 Discussions**: Community Q&A and feature discussions
- **🔧 Contributing**: Open source contributions welcome
- **📧 Support**: Community-driven support and assistance

## 🚀 **Roadmap**

### **Current (MVP)**
- ✅ Visual workflow builder
- ✅ Real-time analytics
- ✅ Basic automation triggers
- ✅ GDPR compliance tools

### **Next Release**
- 🔄 Advanced A/B testing
- 🔄 Email integration (SendGrid, Mailgun)
- 🔄 Advanced segmentation
- 🔄 Mobile app analytics

### **Future**
- 📱 Mobile SDK
- 🤖 AI-powered insights
- 🔗 Advanced integrations
- 📊 Custom reporting

---

**Built with ❤️ by the open source community**

*Seentics - Making websites intelligent, one workflow at a time.*
