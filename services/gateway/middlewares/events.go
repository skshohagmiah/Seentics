package middlewares

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/seentics/seentics/services/gateway/cache"
)

var eventsTracker *cache.EventsTracker

// InitEventsTracker initializes the events tracker
func InitEventsTracker() {
	eventsTracker = cache.NewEventsTracker()
	
	// Start the batch sync goroutine
	go startBatchSync()
}

// EventsLimitMiddleware checks monthly events limits before allowing event tracking
func EventsLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Only apply to analytics event endpoints
		if !isEventTrackingEndpoint(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}

		// Extract user info from headers (set by AuthMiddleware)
		userID := r.Header.Get("X-User-ID")
		userPlan := r.Header.Get("X-User-Plan")
		
		if userID == "" {
			// Allow anonymous tracking (will be handled by analytics service)
			next.ServeHTTP(w, r)
			return
		}

		if userPlan == "" {
			userPlan = "free" // Default to free plan
		}

		ctx := context.Background()
		
		// Determine event count from request
		eventCount := getEventCountFromRequest(r)
		
		// Check if user can track more events
		canTrack, currentCount, limit, err := eventsTracker.CheckUserEventsLimit(ctx, userID, userPlan, eventCount)
		if err != nil {
			log.Printf("Error checking events limit for user %s: %v", userID, err)
			// Allow tracking on error (fail open)
			next.ServeHTTP(w, r)
			return
		}

		if !canTrack {
			// Return limit exceeded error
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			
			response := map[string]interface{}{
				"success": false,
				"error":   "MONTHLY_EVENTS_LIMIT_EXCEEDED",
				"message": fmt.Sprintf("Monthly events limit exceeded for %s plan", userPlan),
				"data": map[string]interface{}{
					"current_count": currentCount,
					"limit":         limit,
					"plan":          userPlan,
					"upgrade_required": userPlan != "pro",
				},
			}
			
			json.NewEncoder(w).Encode(response)
			return
		}

		// Increment counter and allow request
		err = eventsTracker.IncrementUserEvents(ctx, userID, eventCount)
		if err != nil {
			log.Printf("Error incrementing events for user %s: %v", userID, err)
			// Continue anyway (fail open)
		}

		next.ServeHTTP(w, r)
	})
}

// Helper function to check if endpoint is for event tracking
func isEventTrackingEndpoint(path string) bool {
	eventEndpoints := []string{
		"/api/v1/analytics/event",
		"/api/v1/analytics/event/batch",
		"/api/v1/analytics/track",
	}
	
	for _, endpoint := range eventEndpoints {
		if strings.HasPrefix(path, endpoint) {
			return true
		}
	}
	
	return false
}

// Helper function to get event count from request
func getEventCountFromRequest(r *http.Request) int64 {
	// For batch endpoints, try to count events in body
	if strings.Contains(r.URL.Path, "/batch") {
		// This is a simplified approach - in reality you'd parse the JSON body
		// For now, assume batch requests have 10 events on average
		return 10
	}
	
	// Single event
	return 1
}

// Batch sync function that runs every 10 minutes
func startBatchSync() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if err := performBatchSync(); err != nil {
				log.Printf("Batch sync error: %v", err)
			}
		}
	}
}

// Perform batch sync to user service
func performBatchSync() error {
	ctx := context.Background()
	
	// Get all active users
	activeUsers, err := eventsTracker.GetAllActiveUsers(ctx)
	if err != nil {
		return fmt.Errorf("failed to get active users: %w", err)
	}

	if len(activeUsers) == 0 {
		log.Println("No active users to sync")
		return nil
	}

	// Get batch data
	batchData, err := eventsTracker.GetUserEventsBatch(ctx, activeUsers)
	if err != nil {
		return fmt.Errorf("failed to get batch data: %w", err)
	}

	if len(batchData) == 0 {
		log.Println("No events data to sync")
		return nil
	}

	// Send to user service
	if err := syncToUserService(batchData); err != nil {
		return fmt.Errorf("failed to sync to user service: %w", err)
	}

	// Reset counters for successfully synced users
	for _, batch := range batchData {
		if err := eventsTracker.ResetUserEventsCounter(ctx, batch.UserID); err != nil {
			log.Printf("Failed to reset counter for user %s: %v", batch.UserID, err)
		}
	}

	log.Printf("Successfully synced %d users' events data", len(batchData))
	return nil
}

// Sync batch data to user service
func syncToUserService(batchData []cache.UserEventsBatch) error {
	userServiceURL := os.Getenv("USER_SERVICE_URL")
	if userServiceURL == "" {
		userServiceURL = "http://localhost:3001"
	}
	
	// Prepare request payload
	payload := map[string]interface{}{
		"events": batchData,
	}
	
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal batch data: %w", err)
	}
	
	// Create HTTP request
	url := fmt.Sprintf("%s/api/v1/user/events/batch", userServiceURL)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	
	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", os.Getenv("GLOBAL_API_KEY"))
	
	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: 30 * time.Second,
	}
	
	// Send request
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request to user service: %w", err)
	}
	defer resp.Body.Close()
	
	// Check response status
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("user service returned status %d", resp.StatusCode)
	}
	
	log.Printf("Successfully synced %d users' events to user service", len(batchData))
	return nil
}

// GetEventsStats returns current events statistics (for monitoring)
func GetEventsStats() (map[string]interface{}, error) {
	if eventsTracker == nil {
		return nil, fmt.Errorf("events tracker not initialized")
	}
	
	ctx := context.Background()
	return eventsTracker.GetEventsStats(ctx)
}
