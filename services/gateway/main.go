package main

import (
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/seentics/seentics/services/gateway/cache"
	"github.com/seentics/seentics/services/gateway/handlers"
	middlewares "github.com/seentics/seentics/services/gateway/middlewares"
)

func main() {
	// Load .env file
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found or failed to load")
	}

	mux := http.NewServeMux()

	redis_err := cache.InitRedis(os.Getenv("REDIS_URL"))

	if redis_err != nil {
		log.Fatal("Redis connection error:", redis_err)
	}

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Response from gateway"))
	})

	// Routes
	mux.HandleFunc("/api/v1/user/", func(w http.ResponseWriter, r *http.Request) {
		proxyTo(w, r, os.Getenv("USER_SERVICE_URL"))
	})

	mux.HandleFunc("/api/v1/analytics/", func(w http.ResponseWriter, r *http.Request) {
		proxyTo(w, r, os.Getenv("ANALYTICS_SERVICE_URL"))
	})

	mux.HandleFunc("/api/v1/workflows/", func(w http.ResponseWriter, r *http.Request) {
		proxyTo(w, r, os.Getenv("WORKFLOW_SERVICE_URL"))
	})

	// Funnel routes - route to analytics service
	mux.HandleFunc("/api/v1/funnels/", func(w http.ResponseWriter, r *http.Request) {
		proxyTo(w, r, os.Getenv("ANALYTICS_SERVICE_URL"))
	})

	// Privacy routes - route to appropriate services based on GDPR requirements
	mux.HandleFunc("/api/v1/privacy/", func(w http.ResponseWriter, r *http.Request) {
		// Route privacy requests based on the specific endpoint
		path := r.URL.Path

		// Analytics privacy operations (export, delete, anonymize analytics data)
		if contains(path, "/export/") || contains(path, "/delete/") || contains(path, "/anonymize/") ||
			contains(path, "/retention-policies") || contains(path, "/cleanup") {
			proxyTo(w, r, os.Getenv("ANALYTICS_SERVICE_URL"))
		} else {
			// User privacy operations (settings, requests, compliance status)
			proxyTo(w, r, os.Getenv("USER_SERVICE_URL"))
		}
	})

	// User privacy routes - route to user service
	mux.HandleFunc("/api/v1/user/privacy/", func(w http.ResponseWriter, r *http.Request) {
		proxyTo(w, r, os.Getenv("USER_SERVICE_URL"))
	})

	// Analytics privacy routes - route to analytics service
	mux.HandleFunc("/api/v1/analytics/privacy/", func(w http.ResponseWriter, r *http.Request) {
		proxyTo(w, r, os.Getenv("ANALYTICS_SERVICE_URL"))
	})

	// Admin routes - internal use only (frontend will handle admin code authentication)
	// TODO: Add proper admin authentication middleware
	mux.HandleFunc("/api/v1/admin/stats", handlers.GetAdminStats)
	mux.HandleFunc("/api/v1/admin/users", handlers.GetUsersList)
	mux.HandleFunc("/api/v1/admin/websites", handlers.GetWebsitesList)

	// Initialize events tracker
	middlewares.InitEventsTracker()

	handler := middlewares.ApplyMiddleware(mux, middlewares.LoggingMiddleware, middlewares.CORSMiddleware, middlewares.RateLimiterMiddleware, middlewares.AuthMiddleware, middlewares.EventsLimitMiddleware)

	port := os.Getenv("API_GATEWAY_PORT")
	if port == "" {
		port = "8080" // default port
	}

	// Add health check endpoint
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy","service":"gateway"}`))
	})
	
	log.Printf("Gateway is running on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}

func proxyTo(w http.ResponseWriter, r *http.Request, target string) {
	if target == "" {
		http.Error(w, "Service unavailable", http.StatusServiceUnavailable)
		return
	}
	
	targetURL, err := url.Parse(target)
	if err != nil {
		log.Printf("Invalid target URL %s: %v", target, err)
		http.Error(w, "Service configuration error", http.StatusInternalServerError)
		return
	}
	proxy := httputil.NewSingleHostReverseProxy(targetURL)

	// Add timeout configuration
	proxy.Transport = &http.Transport{
		ResponseHeaderTimeout: 30 * time.Second,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}

	// Add API key header for inter-service communication
	globalAPIKey := os.Getenv("GLOBAL_API_KEY")
	if globalAPIKey != "" {
		r.Header.Set("X-API-Key", globalAPIKey)
	}

	proxy.ServeHTTP(w, r)
}

// Helper function to check if a string contains a substring
func contains(s, substr string) bool {
	return strings.Contains(s, substr)
}
