package handlers

import (
	"analytics-app/middleware"
	"analytics-app/models"
	"analytics-app/services"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
)

type EventHandler struct {
	service               *services.EventService
	logger                zerolog.Logger
	subscriptionMiddleware *middleware.SubscriptionMiddleware
}

func NewEventHandler(service *services.EventService, logger zerolog.Logger) *EventHandler {
	return &EventHandler{
		service:                service,
		logger:                 logger,
		subscriptionMiddleware: middleware.NewSubscriptionMiddleware(logger),
	}
}

func (h *EventHandler) TrackEvent(c *gin.Context) {
	var event models.Event
	if err := c.ShouldBindJSON(&event); err != nil {
		h.logger.Error().Err(err).Msg("Failed to bind event data")
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid event data",
			"details": err.Error(),
		})
		return
	}

	// Validate required fields
	if event.WebsiteID == "" || event.VisitorID == "" {
		h.logger.Error().
			Str("website_id", event.WebsiteID).
			Str("visitor_id", event.VisitorID).
			Msg("Missing required fields")
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Missing required fields: website_id and visitor_id",
		})
		return
	}

	response, err := h.service.TrackEvent(c.Request.Context(), &event)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to track event")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to track event",
		})
		return
	}

	// Increment event usage counter after successful tracking
	userID := c.GetHeader("x-user-id")
	if userID != "" {
		if err := h.subscriptionMiddleware.IncrementEventUsage(userID, 1); err != nil {
			h.logger.Error().Err(err).Str("user_id", userID).Msg("Failed to increment event usage")
			// Don't fail the request if usage increment fails
		}
	}

	c.JSON(http.StatusCreated, response)
}

func (h *EventHandler) TrackBatchEvents(c *gin.Context) {
	var req models.BatchEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.Error().Err(err).Msg("Failed to bind batch event data")
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid batch event data",
			"details": err.Error(),
		})
		return
	}

	// Validate batch request
	if req.SiteID == "" || len(req.Events) == 0 {
		h.logger.Error().
			Str("site_id", req.SiteID).
			Int("events_count", len(req.Events)).
			Msg("Invalid batch request")
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Missing required fields: siteId and events",
		})
		return
	}

	// Optimize events by removing redundant data and parsing user agents server-side
	h.optimizeEventBatch(&req)

	// Validate individual events
	for i, event := range req.Events {
		if event.VisitorID == "" {
			h.logger.Error().
				Int("event_index", i).
				Msg("Event missing visitor_id")
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("Event at index %d missing visitor_id", i),
			})
			return
		}
	}

	response, err := h.service.TrackBatchEvents(c.Request.Context(), &req)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to track batch events")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to track batch events",
		})
		return
	}

	// Increment event usage counter after successful batch tracking
	userID := c.GetHeader("x-user-id")
	if userID != "" {
		eventCount := len(req.Events)
		if err := h.subscriptionMiddleware.IncrementEventUsage(userID, eventCount); err != nil {
			h.logger.Error().Err(err).Str("user_id", userID).Int("event_count", eventCount).Msg("Failed to increment batch event usage")
			// Don't fail the request if usage increment fails
		}
	}

	c.JSON(http.StatusCreated, response)
}

// optimizeEventBatch processes events to reduce redundant data and parse user agents server-side
func (h *EventHandler) optimizeEventBatch(req *models.BatchEventRequest) {
	var sessionUserAgent string
	var sessionReferrer string
	var sessionBrowser string
	var sessionDevice string
	var sessionOS string
	
	for i := range req.Events {
		event := &req.Events[i]
		
		// Parse user agent server-side if provided
		if event.UserAgent != nil && *event.UserAgent != "" {
			if sessionUserAgent != *event.UserAgent {
				sessionUserAgent = *event.UserAgent
				sessionBrowser, sessionDevice, sessionOS = h.parseUserAgent(sessionUserAgent)
			}
			
			// Set parsed values
			if sessionBrowser != "" {
				event.Browser = &sessionBrowser
			}
			if sessionDevice != "" {
				event.Device = &sessionDevice
			}
			if sessionOS != "" {
				event.OS = &sessionOS
			}
			
			// Clear user agent to save bandwidth
			event.UserAgent = nil
		}
		
		// Optimize referrer - only keep if it's different from previous
		if event.Referrer != nil && *event.Referrer != "" {
			if sessionReferrer == *event.Referrer {
				event.Referrer = nil // Remove duplicate referrer
			} else {
				sessionReferrer = *event.Referrer
			}
		}
		
		// Set website_id from batch if not set
		if event.WebsiteID == "" {
			event.WebsiteID = req.SiteID
		}
	}
}

// parseUserAgent extracts browser, device, and OS from user agent string
func (h *EventHandler) parseUserAgent(userAgent string) (browser, device, os string) {
	// Simple user agent parsing
	ua := userAgent
	
	// Browser detection
	if contains(ua, "Chrome") {
		browser = "Chrome"
	} else if contains(ua, "Firefox") {
		browser = "Firefox"
	} else if contains(ua, "Safari") {
		browser = "Safari"
	} else if contains(ua, "Edge") {
		browser = "Edge"
	} else {
		browser = "Other"
	}
	
	// Device detection
	if contains(ua, "iPad") || (contains(ua, "Android") && contains(ua, "Mobile")) {
		device = "Tablet"
	} else if contains(ua, "Mobi") || contains(ua, "Android") {
		device = "Mobile"
	} else {
		device = "Desktop"
	}
	
	// OS detection
	if contains(ua, "Windows") {
		os = "Windows"
	} else if contains(ua, "Mac") {
		os = "macOS"
	} else if contains(ua, "Linux") {
		os = "Linux"
	} else if contains(ua, "Android") {
		os = "Android"
	} else if contains(ua, "iOS") {
		os = "iOS"
	} else {
		os = "Other"
	}
	
	return browser, device, os
}

// contains is a helper function for string matching
func contains(s, substr string) bool {
	return len(s) >= len(substr) && indexOf(s, substr) >= 0
}

// indexOf finds the index of substr in s
func indexOf(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}
