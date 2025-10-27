# Analytics Service Documentation

## 📋 Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Project Structure](#project-structure)
- [Core Components](#core-components)
- [Data Models](#data-models)
- [API Endpoints](#api-endpoints)
- [Database Design](#database-design)
- [Performance Features](#performance-features)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Testing](#testing)
- [Monitoring & Health](#monitoring--health)

## 🎯 Overview

The Analytics Service is a high-performance, Go-based microservice designed to handle website analytics and event tracking. It provides real-time data collection, processing, and analysis capabilities with optimized time-series storage using TimescaleDB and PostgreSQL.

**Key Capabilities:**
- Real-time event tracking and ingestion with batch processing
- Advanced geolocation analytics with IP-to-location mapping
- Performance-optimized time-series queries with partitioning
- Automated data enrichment (user agent parsing, geolocation)
- Scalable architecture for high-traffic websites
- Efficient batch processing with configurable batch sizes
- Geographic analytics (countries, cities, continents, regions)

## 🏗️ Architecture

### High-Level Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │───▶│ Analytics       │───▶│   TimescaleDB   │
│   Trackers      │    │ Service (Go)    │    │   (PostgreSQL)  │
│   (JavaScript)  │    │   Port 8080     │    │   + Partitions  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Redis Cache   │    │   MaxMind DB    │
                       │   + Geolocation │    │   (Geolocation) │
                       └─────────────────┘    └─────────────────┘
```

### Service Architecture Pattern
The service follows a **Clean Architecture** pattern with clear separation of concerns:

```
HTTP Layer (Handlers) → Business Logic (Services) → Data Access (Repository) → Database
                     ↓                        ↓                         ↓
                 - REST APIs              - Event Processing      - TimescaleDB
                 - Batch Processing       - Geolocation Service   - Redis Cache
                 - CORS & Auth           - Data Enrichment       - Partitioning
```
```

## ✨ Features

### 🎯 Core Analytics
- **Event Tracking**: Page views, custom events, user interactions
- **Batch Processing**: Efficient event ingestion with configurable batch sizes
- **Geographic Analytics**: IP-to-location mapping with countries, cities, regions, continents
- **Data Enrichment**: Automatic user agent parsing and geolocation
- **Time-series Storage**: Optimized TimescaleDB with automatic partitioning
- **Caching Layer**: Redis-based caching for geolocation and frequent queries
- **Referrer Analysis**: Traffic source and campaign attribution

### 🔄 Funnel Analytics
- **Conversion Funnels**: Multi-step conversion path analysis
- **Drop-off Tracking**: Identify where users abandon conversion flows
- **Funnel Performance**: Conversion rates and optimization insights
- **Custom Funnel Creation**: Build and track custom conversion paths

### 📊 Advanced Analytics
- **UTM Campaign Tracking**: Marketing campaign performance analysis
- **Session Analysis**: Session duration, pages per session metrics
- **Bounce Rate Analysis**: Page and referrer bounce rate insights
- **Performance Metrics**: Page load times and user experience data

### 🚀 Performance Features
- **Batch Processing**: Configurable batch sizes (default 1000 events)
- **Connection Pooling**: Efficient PostgreSQL connection management
- **Multi-level Caching**: Redis + in-memory caching for geolocation
- **Automatic Partitioning**: Time-based table partitioning by timestamp
- **Optimized Indexing**: Strategic indexes for website_id, timestamp, and geolocation
- **Data Enrichment**: Efficient IP-to-location with MaxMind DB integration
- **Graceful Shutdown**: Proper cleanup of batch processors and connections

### Project Structure

```
services/analytics/
├── 📁 config/                 # Configuration management
│   ├── config.go             # Environment and service configuration
│   └── env.production.example # Production environment template
├── 📁 database/               # Database connection and migrations
│   ├── connection.go         # Database connection management
│   └── timescale.go          # TimescaleDB specific operations
├── 📁 handlers/               # HTTP request handlers
│   ├── analytics_handler.go  # Main analytics endpoints
│   ├── event_handler.go      # Event tracking endpoints
│   ├── funnel_handler.go     # Funnel analysis endpoints
│   └── health_handler.go     # Health check endpoints
├── 📁 middleware/             # HTTP middleware
│   ├── auth.go               # Authentication middleware
│   └── cors.go               # CORS configuration
├── 📁 models/                 # Data models and structs
│   ├── analytics.go          # Analytics data models
│   ├── event.go              # Event tracking models
│   ├── funnel.go             # Funnel analysis models
│   ├── jsonb.go              # JSONB utility models
│   └── timescale.go          # TimescaleDB specific models
├── 📁 repository/             # Database operations layer
│   ├── analytics_repository.go    # Core analytics queries
│   ├── analytics_queries.go       # Analytics SQL queries
│   ├── continuous_aggregates.go   # Continuous aggregates management
│   ├── event_repository.go        # Event data operations
│   ├── funnel_repository.go       # Funnel analysis queries
│   ├── time_series_queries.go     # Time-series specific queries
│   ├── timescale_analytics.go     # TimescaleDB analytics
│   └── timescale_queries.go       # TimescaleDB queries
├── 📁 services/               # Business logic layer
│   ├── analytics_service.go  # Main analytics business logic
│   ├── event_service.go      # Event processing logic
│   └── funnel_service.go     # Funnel analysis logic
├── 📁 utils/                  # Utility functions
├── 📁 tests/                  # Test files
├── 📁 main.go                 # Application entry point
├── 📁 go.mod                  # Go module dependencies
├── 📁 go.sum                  # Dependency checksums
├── 📁 Dockerfile              # Docker configuration
└── 📁 README.md               # Service documentation
```

## 🔧 Core Components

### 1. **Handlers Layer** 📡
**Purpose**: HTTP request/response handling and API endpoint management

**Key Responsibilities**:
- Receive HTTP requests from the API gateway
- Validate request parameters and authentication
- Route requests to appropriate services
- Format and return HTTP responses
- Handle errors and logging

**Example Handler**:
```go
func (h *AnalyticsHandler) GetDashboard(c *gin.Context) {
    websiteID := c.Param("website_id")
    days := parseDaysParam(c.Query("days"))
    
    data, err := h.service.GetDashboard(c.Request.Context(), websiteID, days)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(http.StatusOK, data)
}
```

### 2. **Services Layer** 🧠
**Purpose**: Business logic orchestration and data processing

**Key Responsibilities**:
- Implement core business logic for analytics
- Coordinate between handlers and repositories
- Apply business rules and data transformations
- Handle complex operations requiring multiple repository calls
- Provide clean interfaces for handlers

**Example Service**:
```go
func (s *AnalyticsService) GetDashboard(ctx context.Context, websiteID string, days int) (*models.DashboardData, error) {
    metrics, err := s.repo.GetDashboardMetrics(ctx, websiteID, days)
    if err != nil {
        return nil, fmt.Errorf("failed to get dashboard metrics: %w", err)
    }
    
    comparison, _ := s.repo.GetComparisonMetrics(ctx, websiteID, days)
    utmData, _ := s.repo.GetUTMAnalytics(ctx, websiteID, days)
    
    return &models.DashboardData{
        WebsiteID:      websiteID,
        DateRange:      fmt.Sprintf("%d days", days),
        Metrics:        *metrics,
        Comparison:     comparison,
        UTMPerformance: utmData,
    }, nil
}
```

### 3. **Repository Layer** 🗄️
**Purpose**: Data access and database operations

**Key Responsibilities**:
- Execute SQL queries against TimescaleDB
- Manage database connections and transactions
- Handle continuous aggregates and materialized views
- Provide data access methods for services
- Optimize queries for time-series data

**Example Repository**:
```go
func (r *AnalyticsRepository) GetDashboardMetrics(ctx context.Context, websiteID string, days int) (*models.DashboardMetrics, error) {
    query := `
        SELECT 
            COUNT(*) as page_views,
            COUNT(DISTINCT visitor_id) as unique_visitors,
            COUNT(DISTINCT session_id) as sessions,
            COALESCE(AVG(time_on_page), 0) as avg_time_on_page
        FROM events
        WHERE website_id = $1 
        AND timestamp >= NOW() - INTERVAL '%d days'`
    
    var metrics models.DashboardMetrics
    err := r.db.QueryRow(ctx, fmt.Sprintf(query, days), websiteID).Scan(
        &metrics.PageViews, &metrics.UniqueVisitors, 
        &metrics.Sessions, &metrics.AvgTimeOnPage,
    )
    
    return &metrics, err
}
```

## 📊 Data Models

### Core Analytics Models
```go
type DashboardMetrics struct {
    PageViews       int     `json:"page_views"`
    UniqueVisitors  int     `json:"unique_visitors"`
    Sessions        int     `json:"sessions"`
    BounceRate      float64 `json:"bounce_rate"`
    AvgSessionTime  int     `json:"avg_session_time"`
    PagesPerSession float64 `json:"pages_per_session"`
}

type RealtimeData struct {
    WebsiteID        string     `json:"website_id"`
    ActiveUsers      int        `json:"active_users"`
    CurrentVisitors  int        `json:"current_visitors"`
    PageViewsLast5m  int        `json:"page_views_last_5m"`
    PageViewsLast1h  int        `json:"page_views_last_1h"`
    TopPagesRealtime []PageStat `json:"top_pages_realtime"`
}

type PageStat struct {
    Page       string   `json:"page"`
    Views      int      `json:"views"`
    Unique     int      `json:"unique"`
    BounceRate *float64 `json:"bounce_rate,omitempty"`
    AvgTime    *int     `json:"avg_time,omitempty"`
    ExitRate   *float64 `json:"exit_rate,omitempty"`
}
```

### Event Tracking Models
```go
type Event struct {
    ID          string                 `json:"id" db:"id"`
    WebsiteID   string                 `json:"website_id" db:"website_id"`
    VisitorID   string                 `json:"visitor_id" db:"visitor_id"`
    SessionID   string                 `json:"session_id" db:"session_id"`
    EventType   string                 `json:"event_type" db:"event_type"`
    Page        string                 `json:"page" db:"page"`
    Referrer    *string                `json:"referrer,omitempty" db:"referrer"`
    UserAgent   string                 `json:"user_agent" db:"user_agent"`
    Timestamp   time.Time              `json:"timestamp" db:"timestamp"`
    Properties  map[string]interface{} `json:"properties,omitempty" db:"properties"`
}
```

### Funnel Analysis Models
```go
type Funnel struct {
    ID          string        `json:"id" db:"id"`
    WebsiteID   string        `json:"website_id" db:"website_id"`
    Name        string        `json:"name" db:"name"`
    Steps       []FunnelStep  `json:"steps" db:"steps"`
    CreatedAt   time.Time     `json:"created_at" db:"created_at"`
    UpdatedAt   time.Time     `json:"updated_at" db:"updated_at"`
}

type FunnelStep struct {
    ID          string `json:"id" db:"id"`
    Name        string `json:"name" db:"name"`
    Page        string `json:"page" db:"page"`
    EventType   string `json:"event_type" db:"event_type"`
    Order       int    `json:"order" db:"order"`
}
```

## 🌐 API Endpoints

### **Event Tracking**
```
POST   /api/v1/analytics/event           # Track single event
POST   /api/v1/analytics/event/batch     # Track multiple events (recommended)
```

### **Dashboard Analytics**
```
GET    /api/v1/analytics/dashboard/:websiteId          # Get dashboard metrics
GET    /api/v1/analytics/dashboard/:websiteId/pages    # Get top pages
GET    /api/v1/analytics/dashboard/:websiteId/sources  # Get traffic sources
GET    /api/v1/analytics/dashboard/:websiteId/devices  # Get device analytics
```

### **Geographic Analytics**
```
GET    /api/v1/analytics/geo/:websiteId/countries      # Get top countries
GET    /api/v1/analytics/geo/:websiteId/cities         # Get top cities
GET    /api/v1/analytics/geo/:websiteId/continents     # Get top continents
GET    /api/v1/analytics/geo/:websiteId/regions        # Get top regions
```

### **Time-series Analytics**
```
GET    /api/v1/analytics/timeseries/:websiteId         # Get time-series data
GET    /api/v1/analytics/timeseries/:websiteId/hourly  # Get hourly breakdown
GET    /api/v1/analytics/timeseries/:websiteId/daily   # Get daily breakdown
```

### **Health & Status**
```
GET    /health                                         # Health check
GET    /api/v1/analytics/health                        # Detailed health info
```

### **Example API Requests**

#### Track Events (Batch)
```bash
curl -X POST http://localhost:8080/api/v1/analytics/event/batch \
  -H "Content-Type: application/json" \
  -d '{
    "events": [
      {
        "website_id": "site-123",
        "visitor_id": "visitor-456",
        "session_id": "session-789",
        "event_type": "pageview",
        "page": "/home",
        "referrer": "https://google.com",
        "user_agent": "Mozilla/5.0...",
        "ip_address": "192.168.1.1",
        "timestamp": "2024-01-15T10:30:00Z"
      }
    ]
  }'
```

#### Get Dashboard Data
```bash
curl "http://localhost:8080/api/v1/analytics/dashboard/site-123?days=30" \
  -H "Authorization: Bearer your-jwt-token"
```

#### Get Geographic Analytics
```bash
curl "http://localhost:8080/api/v1/analytics/geo/site-123/countries?days=7&limit=10" \
  -H "Authorization: Bearer your-jwt-token"
```

### Analytics Endpoints
```
GET  /api/v1/analytics/{website_id}/dashboard
GET  /api/v1/analytics/{website_id}/realtime
GET  /api/v1/analytics/{website_id}/top-pages
GET  /api/v1/analytics/{website_id}/top-referrers
GET  /api/v1/analytics/{website_id}/top-countries
GET  /api/v1/analytics/{website_id}/top-browsers
GET  /api/v1/analytics/{website_id}/top-devices
GET  /api/v1/analytics/{website_id}/top-os
GET  /api/v1/analytics/{website_id}/daily-stats
GET  /api/v1/analytics/{website_id}/hourly-stats
```

### Event Tracking Endpoints
```
POST /api/v1/events/track
GET  /api/v1/events/{website_id}/recent
GET  /api/v1/events/{website_id}/custom-events
```

### Funnel Analysis Endpoints
```
GET  /api/v1/funnels/{website_id}
POST /api/v1/funnels
PUT  /api/v1/funnels/{funnel_id}
DELETE /api/v1/funnels/{funnel_id}
GET  /api/v1/funnels/{funnel_id}/performance
```

### Health & Monitoring Endpoints
```
GET  /health
GET  /ready
GET  /metrics
```

## 🗄️ Database Design

### Core Tables
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

-- Create hypertable for time-series optimization
SELECT create_hypertable('events', 'timestamp');

-- Create indexes for performance
CREATE INDEX idx_events_website_timestamp ON events (website_id, timestamp DESC);
CREATE INDEX idx_events_visitor_session ON events (visitor_id, session_id);
CREATE INDEX idx_events_type_timestamp ON events (event_type, timestamp DESC);
```

### Continuous Aggregates
```sql
-- Daily aggregates for dashboard performance
CREATE MATERIALIZED VIEW events_daily
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 day', timestamp) AS day,
    website_id,
    COUNT(*) AS page_views,
    COUNT(DISTINCT visitor_id) AS unique_visitors,
    COUNT(DISTINCT session_id) AS sessions,
    ROUND(AVG(CASE WHEN time_on_page > 0 THEN time_on_page END)) AS avg_time_on_page
FROM events
GROUP BY day, website_id;

-- Hourly aggregates for real-time analytics
CREATE MATERIALIZED VIEW events_hourly
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 hour', timestamp) AS hour,
    website_id,
    COUNT(*) AS page_views,
    COUNT(DISTINCT visitor_id) AS unique_visitors
FROM events
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY hour, website_id;
```

## ⚡ Performance Features

### 1. **Continuous Aggregates**
- Automated data summarization at regular intervals
- Pre-computed metrics for fast dashboard queries
- Configurable aggregation windows (hourly, daily, weekly)
- Automatic refresh and maintenance

### 2. **Materialized Views**
- Pre-computed analytics for complex queries
- Reduced query execution time for dashboards
- Automatic updates based on data changes
- Memory-efficient storage of aggregated data

### 3. **Connection Pooling**
- Optimized database connection management
- Configurable pool sizes for different workloads
- Connection reuse for improved performance
- Automatic connection health monitoring

### 4. **Query Optimization**
- TimescaleDB-specific optimizations for time-series data
- Efficient indexing strategies for common query patterns
- Query result caching for frequently accessed data
- Batch processing for bulk operations

## ⚙️ Configuration

### Environment Variables
```bash
# Service Configuration
ANALYTICS_SERVICE_PORT=3002
LOG_LEVEL=info
ENVIRONMENT=development

# Database Configuration
DATABASE_URL=postgresql://user:pass@localhost:5432/analytics?sslmode=disable
MAX_DB_CONNECTIONS=100
DB_CONNECTION_TIMEOUT=30s

# Processing Configuration
BATCH_SIZE=1000
BATCH_TIMEOUT=5s
WORKER_COUNT=10

# Data Retention
RETENTION_DAYS=90
AGGREGATION_INTERVAL=24h
AGGREGATION_TIME=00:00

# Performance Tuning
GOMAXPROCS=4
HTTP_READ_TIMEOUT=15s
HTTP_WRITE_TIMEOUT=15s
HTTP_IDLE_TIMEOUT=60s
```

### Configuration Structure
```go
type Config struct {
    Port                string        `env:"ANALYTICS_SERVICE_PORT" envDefault:"3002"`
    LogLevel            string        `env:"LOG_LEVEL" envDefault:"info"`
    Environment         string        `env:"ENVIRONMENT" envDefault:"development"`
    DatabaseURL         string        `env:"DATABASE_URL,required"`
    MaxDBConnections    int           `env:"MAX_DB_CONNECTIONS" envDefault:"100"`
    BatchSize           int           `env:"BATCH_SIZE" envDefault:"1000"`
    BatchTimeout        time.Duration `env:"BATCH_TIMEOUT" envDefault:"5s"`
    RetentionDays       int           `env:"RETENTION_DAYS" envDefault:"90"`
}
```

## 🚀 Deployment

### Docker Deployment
```dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o analytics-service .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/

COPY --from=builder /app/analytics-service .
COPY --from=builder /app/config ./config

EXPOSE 3002
CMD ["./analytics-service"]
```

### Docker Compose
```yaml
version: '3.8'
services:
  analytics:
    build: ./services/analytics
    ports:
      - "3002:3002"
    environment:
      - DATABASE_URL=postgresql://user:pass@timescale:5432/analytics
      - LOG_LEVEL=info
    depends_on:
      - timescale
    networks:
      - analytics-network

  timescale:
    image: timescale/timescaledb:latest-pg15
    environment:
      - POSTGRES_DB=analytics
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - timescale-data:/var/lib/postgresql/data
    networks:
      - analytics-network

volumes:
  timescale-data:

networks:
  analytics-network:
    driver: bridge
```

## 🧪 Testing

### Test Structure
```
services/analytics/tests/
├── unit/                    # Unit tests
│   ├── handlers/           # Handler tests
│   ├── services/           # Service tests
│   └── repository/         # Repository tests
├── integration/             # Integration tests
│   ├── api/                # API endpoint tests
│   └── database/           # Database integration tests
└── performance/             # Performance tests
    ├── load/                # Load testing
    └── benchmark/           # Benchmark tests
```

### Running Tests
```bash
# Run all tests
go test ./...

# Run specific test categories
go test ./handlers/...
go test ./services/...
go test ./repository/...

# Run with coverage
go test -cover ./...

# Run integration tests
go test -tags=integration ./...

# Run performance tests
go test -tags=performance ./...
```

## 📊 Monitoring & Health

### Health Check Endpoints
```go
func (h *HealthHandler) Health(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{
        "status": "healthy",
        "timestamp": time.Now().UTC(),
        "service": "analytics",
        "version": "1.0.0",
    })
}

func (h *HealthHandler) Ready(c *gin.Context) {
    // Check database connectivity
    if err := h.db.Ping(c.Request.Context()); err != nil {
        c.JSON(http.StatusServiceUnavailable, gin.H{
            "status": "not ready",
            "error": "database connection failed",
        })
        return
    }
    
    c.JSON(http.StatusOK, gin.H{
        "status": "ready",
        "timestamp": time.Now().UTC(),
    })
}
```

### Metrics Collection
```go
// Prometheus metrics for monitoring
var (
    httpRequestsTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "http_requests_total",
            Help: "Total number of HTTP requests",
        },
        []string{"method", "endpoint", "status"},
    )
    
    eventProcessingDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name: "event_processing_duration_seconds",
            Help: "Time spent processing events",
        },
        []string{"event_type"},
    )
)
```

## 🔧 Development Setup

### Prerequisites
- Go 1.21+
- TimescaleDB 2.0+
- Docker and Docker Compose
- Make (optional, for build automation)

### Local Development
```bash
# Clone and setup
git clone <repository>
cd services/analytics

# Install dependencies
go mod tidy

# Setup environment
cp env.example .env
# Edit .env with your configuration

# Start dependencies
docker-compose up -d timescale

# Run migrations
go run ./cmd/migrate

# Start service
go run main.go

# Run tests
go test ./...
```

### Development Workflow
1. **Feature Development**: Create feature branch from main
2. **Code Changes**: Implement changes following Go best practices
3. **Testing**: Write unit and integration tests
4. **Code Review**: Submit pull request for review
5. **Integration**: Merge after approval and CI/CD validation

## 📚 Additional Resources

- [TimescaleDB Documentation](https://docs.timescale.com/)
- [Go Best Practices](https://golang.org/doc/effective_go.html)
- [Gin Framework Documentation](https://gin-gonic.com/docs/)
- [PostgreSQL JSONB Guide](https://www.postgresql.org/docs/current/datatype-json.html)

---

**Last Updated**: December 2024  
**Version**: 1.0.0  
**Maintainer**: Analytics Team
