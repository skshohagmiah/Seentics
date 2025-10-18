package handlers

import (
	"analytics-app/models"
	"analytics-app/services"
	"analytics-app/utils"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

type FunnelHandler struct {
	service      *services.FunnelService
	logger       zerolog.Logger
	usageTracker *utils.UsageTracker
}

func NewFunnelHandler(service *services.FunnelService, logger zerolog.Logger) *FunnelHandler {
	return &FunnelHandler{
		service:      service,
		logger:       logger,
		usageTracker: utils.NewUsageTracker(logger),
	}
}

func (h *FunnelHandler) CreateFunnel(c *gin.Context) {
	var req models.CreateFunnelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.Error().Err(err).Msg("Failed to bind funnel data")
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid funnel data",
			"details": err.Error(),
		})
		return
	}

	funnel, err := h.service.CreateFunnel(c.Request.Context(), &req)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to create funnel")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create funnel"})
		return
	}

	// Increment funnel usage counter (real-time to database)
	if userID, exists := c.Get("user_id"); exists {
		if userIDStr, ok := userID.(string); ok {
			if err := h.usageTracker.IncrementUsage(userIDStr, "funnels", 1); err != nil {
				h.logger.Warn().Err(err).Msg("Failed to increment funnel usage counter")
			}
		}
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    funnel,
	})
}

func (h *FunnelHandler) GetFunnels(c *gin.Context) {
	websiteID := c.Query("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	funnels, err := h.service.GetFunnels(c.Request.Context(), websiteID)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get funnels")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get funnels"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    funnels,
	})
}

// GetActiveFunnels - Public endpoint for tracker to fetch active funnels
func (h *FunnelHandler) GetActiveFunnels(c *gin.Context) {
	websiteID := c.Query("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	funnels, err := h.service.GetFunnels(c.Request.Context(), websiteID)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get active funnels")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get active funnels"})
		return
	}

	h.logger.Info().Int("total_funnels", len(funnels)).Msg("Retrieved funnels from database")

	// Filter only active funnels and remove sensitive data
	var activeFunnels []models.Funnel
	for _, funnel := range funnels {
		h.logger.Info().
			Str("funnel_id", funnel.ID.String()).
			Str("funnel_name", funnel.Name).
			Bool("is_active", funnel.IsActive).
			Msg("Processing funnel")

		if funnel.IsActive {
			// Create a public version without sensitive fields
			publicFunnel := models.Funnel{
				ID:          funnel.ID,
				Name:        funnel.Name,
				Description: funnel.Description,
				WebsiteID:   funnel.WebsiteID,
				Steps:       funnel.Steps,
				IsActive:    funnel.IsActive,
				CreatedAt:   funnel.CreatedAt,
				UpdatedAt:   funnel.UpdatedAt,
				// Don't include UserID in public response
			}
			activeFunnels = append(activeFunnels, publicFunnel)
		}
	}

	h.logger.Info().Int("active_funnels", len(activeFunnels)).Msg("Returning active funnels to tracker")
	c.JSON(http.StatusOK, activeFunnels)
}

func (h *FunnelHandler) GetFunnel(c *gin.Context) {
	funnelIDStr := c.Param("funnel_id")
	funnelID, err := uuid.Parse(funnelIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid funnel ID"})
		return
	}

	funnel, err := h.service.GetFunnel(c.Request.Context(), funnelID)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get funnel")
		c.JSON(http.StatusNotFound, gin.H{"error": "Funnel not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"funnel": funnel})
}

func (h *FunnelHandler) UpdateFunnel(c *gin.Context) {
	funnelIDStr := c.Param("funnel_id")
	funnelID, err := uuid.Parse(funnelIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid funnel ID"})
		return
	}

	var req models.UpdateFunnelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.Error().Err(err).Msg("Failed to bind funnel update data")
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid funnel data",
			"details": err.Error(),
		})
		return
	}

	funnel, err := h.service.UpdateFunnel(c.Request.Context(), funnelID, &req)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to update funnel")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update funnel"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"funnel": funnel})
}

func (h *FunnelHandler) DeleteFunnel(c *gin.Context) {
	funnelIDStr := c.Param("funnel_id")
	funnelID, err := uuid.Parse(funnelIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid funnel ID"})
		return
	}

	// Get funnel details before deletion to extract user info
	funnel, err := h.service.GetFunnel(c.Request.Context(), funnelID)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get funnel for deletion")
		c.JSON(http.StatusNotFound, gin.H{"error": "Funnel not found"})
		return
	}

	err = h.service.DeleteFunnel(c.Request.Context(), funnelID)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to delete funnel")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete funnel"})
		return
	}

	// Decrement funnel usage counter
	if userID, exists := c.Get("user_id"); exists {
		if userIDStr, ok := userID.(string); ok {
			if err := h.usageTracker.DecrementUsage(userIDStr, "funnels", 1); err != nil {
				h.logger.Warn().Err(err).Msg("Failed to decrement funnel usage counter")
			}
		}
	} else if funnel.UserID != nil && *funnel.UserID != "" {
		// Fallback to funnel's user ID if not in context
		if err := h.usageTracker.DecrementUsage(*funnel.UserID, "funnels", 1); err != nil {
			h.logger.Warn().Err(err).Msg("Failed to decrement funnel usage counter")
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Funnel deleted successfully",
	})
}

func (h *FunnelHandler) TrackFunnelEvent(c *gin.Context) {
	var event models.FunnelEvent
	if err := c.ShouldBindJSON(&event); err != nil {
		h.logger.Error().Err(err).Msg("Failed to bind funnel event data")
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid funnel event data",
			"details": err.Error(),
		})
		return
	}

	// Use async processing for better performance
	err := h.service.TrackFunnelEventAsync(event)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to queue funnel event")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to queue funnel event"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"status":     "success",
		"funnel_id":  event.FunnelID,
		"visitor_id": event.VisitorID,
		"session_id": event.SessionID,
		"message":    "Event queued for processing",
	})
}

// TrackFunnelEventsBatch - NEW: Batch processing endpoint for funnel events
func (h *FunnelHandler) TrackFunnelEventsBatch(c *gin.Context) {
	var req struct {
		Events []models.FunnelEvent `json:"events" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.Error().Err(err).Msg("Failed to bind funnel events batch data")
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid funnel events batch data",
			"details": err.Error(),
		})
		return
	}

	if len(req.Events) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Events array cannot be empty"})
		return
	}

	// Queue all events for async batch processing
	queued := 0
	failed := 0

	for _, event := range req.Events {
		err := h.service.TrackFunnelEventAsync(event)
		if err != nil {
			h.logger.Error().Err(err).
				Str("funnel_id", event.FunnelID.String()).
				Str("visitor_id", event.VisitorID).
				Msg("Failed to queue funnel event in batch")
			failed++
		} else {
			queued++
		}
	}

	h.logger.Info().
		Int("total_events", len(req.Events)).
		Int("queued", queued).
		Int("failed", failed).
		Msg("Queued funnel events batch for processing")

	c.JSON(http.StatusCreated, gin.H{
		"status":  "success",
		"queued":  queued,
		"failed":  failed,
		"total":   len(req.Events),
		"message": "Funnel events batch queued for processing",
	})
}

func (h *FunnelHandler) GetFunnelAnalytics(c *gin.Context) {
	funnelIDStr := c.Param("funnel_id")
	funnelID, err := uuid.Parse(funnelIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid funnel ID"})
		return
	}

	days := 7
	if d := c.Query("days"); d != "" {
		if parsedDays, err := strconv.Atoi(d); err == nil && parsedDays > 0 {
			days = parsedDays
		}
	}

	analytics, err := h.service.GetFunnelAnalytics(c.Request.Context(), funnelID, days)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get funnel analytics")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get funnel analytics"})
		return
	}

	c.JSON(http.StatusOK, analytics)
}

func (h *FunnelHandler) GetDetailedFunnelAnalytics(c *gin.Context) {
	funnelIDStr := c.Param("funnel_id")
	funnelID, err := uuid.Parse(funnelIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid funnel ID"})
		return
	}

	days := 7
	if d := c.Query("days"); d != "" {
		if parsedDays, err := strconv.Atoi(d); err == nil && parsedDays > 0 {
			days = parsedDays
		}
	}

	analytics, err := h.service.GetDetailedFunnelAnalytics(c.Request.Context(), funnelID, days)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get detailed funnel analytics")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get detailed funnel analytics"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   analytics,
	})
}

func (h *FunnelHandler) CompareFunnels(c *gin.Context) {
	websiteID := c.Query("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	var req models.FunnelComparisonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.Error().Err(err).Msg("Failed to bind comparison request")
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid comparison request",
			"details": err.Error(),
		})
		return
	}

	days := 7
	if req.DateRange > 0 {
		days = req.DateRange
	}

	results, err := h.service.CompareFunnels(c.Request.Context(), websiteID, req.FunnelIDs, days)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to compare funnels")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to compare funnels"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   results,
	})
}
