package services

import (
	"analytics-app/models"
	"analytics-app/repository"
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

const (
	// Funnel batch processing constants
	FunnelBatchSize     = 100 // Smaller batch size for funnel events
	FunnelFlushInterval = 3 * time.Second
)

type FunnelService struct {
	repo   *repository.FunnelRepository
	logger zerolog.Logger

	// Batch processing channels
	eventChan chan models.FunnelEvent
	batchChan chan []models.FunnelEvent

	// Shutdown control
	ctx        context.Context
	cancel     context.CancelFunc
	wg         sync.WaitGroup
	isShutdown bool
	shutdownMu sync.RWMutex
}

func NewFunnelService(repo *repository.FunnelRepository, logger zerolog.Logger, redisClient *redis.Client) *FunnelService {
	ctx, cancel := context.WithCancel(context.Background())

	service := &FunnelService{
		repo:      repo,
		logger:    logger,
		eventChan: make(chan models.FunnelEvent, 1000), // Buffered channel
		batchChan: make(chan []models.FunnelEvent, 200),
		ctx:       ctx,
		cancel:    cancel,
	}

	// Start batch processing goroutines
	service.startBatchCollector()
	service.startBatchProcessor()

	return service
}

func (s *FunnelService) CreateFunnel(ctx context.Context, req *models.CreateFunnelRequest) (*models.Funnel, error) {
	s.logger.Info().
		Str("website_id", req.WebsiteID).
		Str("funnel_name", req.Name).
		Msg("Creating funnel")

	funnel := &models.Funnel{
		Name:        req.Name,
		Description: req.Description,
		WebsiteID:   req.WebsiteID,
		UserID:      req.UserID,
		Steps:       req.Steps,
		IsActive:    req.IsActive,
	}

	err := s.repo.Create(ctx, funnel)
	if err != nil {
		s.logger.Error().Err(err).Msg("Failed to create funnel")
		return nil, err
	}

	return funnel, nil
}

func (s *FunnelService) GetFunnels(ctx context.Context, websiteID string) ([]models.Funnel, error) {
	s.logger.Info().
		Str("website_id", websiteID).
		Msg("Getting funnels")

	return s.repo.GetByWebsiteID(ctx, websiteID)
}

func (s *FunnelService) GetFunnel(ctx context.Context, funnelID uuid.UUID) (*models.Funnel, error) {
	s.logger.Info().
		Str("funnel_id", funnelID.String()).
		Msg("Getting funnel")

	return s.repo.GetByID(ctx, funnelID)
}

func (s *FunnelService) UpdateFunnel(ctx context.Context, funnelID uuid.UUID, req *models.UpdateFunnelRequest) (*models.Funnel, error) {
	s.logger.Info().
		Str("funnel_id", funnelID.String()).
		Msg("Updating funnel")

	// Get existing funnel
	funnel, err := s.repo.GetByID(ctx, funnelID)
	if err != nil {
		return nil, err
	}

	// Update fields if provided
	if req.Name != nil {
		funnel.Name = *req.Name
	}
	if req.Description != nil {
		funnel.Description = req.Description
	}
	if req.Steps != nil {
		funnel.Steps = *req.Steps
	}
	if req.IsActive != nil {
		funnel.IsActive = *req.IsActive
	}

	err = s.repo.Update(ctx, funnelID, funnel)
	if err != nil {
		s.logger.Error().Err(err).Msg("Failed to update funnel")
		return nil, err
	}

	return funnel, nil
}

func (s *FunnelService) DeleteFunnel(ctx context.Context, funnelID uuid.UUID) error {
	s.logger.Info().
		Str("funnel_id", funnelID.String()).
		Msg("Deleting funnel")

	return s.repo.Delete(ctx, funnelID)
}

func (s *FunnelService) TrackFunnelEvent(ctx context.Context, event *models.FunnelEvent) error {
	s.logger.Info().
		Str("funnel_id", event.FunnelID.String()).
		Str("visitor_id", event.VisitorID).
		Int("current_step", event.CurrentStep).
		Msg("Tracking funnel event")

	// Validate funnel exists and belongs to website to avoid FK violations
	funnel, err := s.repo.GetByID(ctx, event.FunnelID)
	if err != nil {
		return fmt.Errorf("invalid funnel: %w", err)
	}
	if funnel.WebsiteID != event.WebsiteID {
		return fmt.Errorf("invalid funnel: funnel does not belong to website")
	}

	// Store the event in the database
	if err := s.repo.CreateFunnelEvent(ctx, event); err != nil {
		return err
	}

	// Funnel events are now handled client-side by workflow-tracker.js
	// No need to emit events to workflow service

	return nil
}

// TrackFunnelEventsBatch - NEW: Batch processing for funnel events
func (s *FunnelService) TrackFunnelEventsBatch(ctx context.Context, events []models.FunnelEvent) error {
	if len(events) == 0 {
		return nil
	}

	s.logger.Info().
		Int("batch_size", len(events)).
		Msg("Processing funnel events batch")

	// Process each event with validation
	processed := 0
	for _, event := range events {
		// Validate funnel exists and belongs to website
		funnel, err := s.repo.GetByID(ctx, event.FunnelID)
		if err != nil {
			s.logger.Error().Err(err).
				Str("funnel_id", event.FunnelID.String()).
				Msg("Invalid funnel in batch, skipping")
			continue
		}
		if funnel.WebsiteID != event.WebsiteID {
			s.logger.Error().
				Str("funnel_id", event.FunnelID.String()).
				Str("expected_website", funnel.WebsiteID).
				Str("provided_website", event.WebsiteID).
				Msg("Funnel website mismatch in batch, skipping")
			continue
		}

		// Store the event
		if err := s.repo.CreateFunnelEvent(ctx, &event); err != nil {
			s.logger.Error().Err(err).
				Str("funnel_id", event.FunnelID.String()).
				Str("visitor_id", event.VisitorID).
				Msg("Failed to store funnel event in batch")
			continue
		}
		processed++
	}

	s.logger.Info().
		Int("total_events", len(events)).
		Int("processed", processed).
		Int("failed", len(events)-processed).
		Msg("Completed funnel events batch processing")

	return nil
}

func (s *FunnelService) GetFunnelAnalytics(ctx context.Context, funnelID uuid.UUID, days int) (*models.FunnelAnalytics, error) {
	s.logger.Info().
		Str("funnel_id", funnelID.String()).
		Int("days", days).
		Msg("Getting funnel analytics")

	analytics, err := s.repo.GetFunnelAnalytics(ctx, funnelID, days)
	if err != nil {
		return nil, fmt.Errorf("failed to get funnel analytics: %w", err)
	}

	return analytics, nil
}

func (s *FunnelService) GetDetailedFunnelAnalytics(ctx context.Context, funnelID uuid.UUID, days int) (*models.DetailedFunnelAnalytics, error) {
	s.logger.Info().
		Str("funnel_id", funnelID.String()).
		Int("days", days).
		Msg("Getting detailed funnel analytics")

	analytics, err := s.repo.GetDetailedFunnelAnalytics(ctx, funnelID, days)
	if err != nil {
		return nil, fmt.Errorf("failed to get detailed funnel analytics: %w", err)
	}

	return analytics, nil
}

func (s *FunnelService) CompareFunnels(ctx context.Context, websiteID string, funnelIDs []string, days int) ([]models.FunnelComparisonResult, error) {
	s.logger.Info().
		Str("website_id", websiteID).
		Strs("funnel_ids", funnelIDs).
		Int("days", days).
		Msg("Comparing funnels")

	var results []models.FunnelComparisonResult

	for _, funnelIDStr := range funnelIDs {
		funnelID, err := uuid.Parse(funnelIDStr)
		if err != nil {
			s.logger.Error().Err(err).Str("funnel_id", funnelIDStr).Msg("Invalid funnel ID")
			continue
		}

		// Get funnel details
		funnel, err := s.repo.GetByID(ctx, funnelID)
		if err != nil {
			s.logger.Error().Err(err).Str("funnel_id", funnelIDStr).Msg("Failed to get funnel")
			continue
		}

		// Get analytics
		analytics, err := s.repo.GetFunnelAnalytics(ctx, funnelID, days)
		if err != nil {
			s.logger.Error().Err(err).Str("funnel_id", funnelIDStr).Msg("Failed to get funnel analytics")
			continue
		}

		// Calculate performance score (weighted combination of metrics)
		performanceScore := s.calculatePerformanceScore(analytics)

		result := models.FunnelComparisonResult{
			FunnelID:         funnelIDStr,
			FunnelName:       funnel.Name,
			TotalStarts:      analytics.TotalStarts,
			TotalConversions: analytics.TotalConversions,
			ConversionRate:   analytics.ConversionRate,
			DropOffRate:      analytics.DropOffRate,
			AvgTimeToConvert: analytics.AvgTimeToConvert,
			PerformanceScore: performanceScore,
		}

		results = append(results, result)
	}

	// Sort by performance score (highest first)
	for i := 0; i < len(results)-1; i++ {
		for j := i + 1; j < len(results); j++ {
			if results[i].PerformanceScore < results[j].PerformanceScore {
				results[i], results[j] = results[j], results[i]
			}
		}
	}

	return results, nil
}

func (s *FunnelService) calculatePerformanceScore(analytics *models.FunnelAnalytics) float64 {
	// Weighted scoring system:
	// - Conversion rate: 50% weight
	// - Drop-off rate: 30% weight (inverted - lower is better)
	// - Time to convert: 20% weight (inverted - lower is better)

	conversionScore := analytics.ConversionRate * 0.5

	dropOffScore := (100 - analytics.DropOffRate) * 0.3

	timeScore := 0.0
	if analytics.AvgTimeToConvert != nil {
		// Normalize time score (assume 10 minutes is perfect, 60 minutes is poor)
		timeMinutes := float64(*analytics.AvgTimeToConvert) / 60.0
		if timeMinutes <= 10 {
			timeScore = 100 * 0.2
		} else if timeMinutes <= 60 {
			timeScore = (60 - timeMinutes) / 50 * 100 * 0.2
		}
		// If more than 60 minutes, time score is 0
	}

	return conversionScore + dropOffScore + timeScore
}

// startBatchCollector collects funnel events and batches them
func (s *FunnelService) startBatchCollector() {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()

		ticker := time.NewTicker(FunnelFlushInterval)
		defer ticker.Stop()

		batch := make([]models.FunnelEvent, 0, FunnelBatchSize)

		for {
			select {
			case <-s.ctx.Done():
				// Flush remaining batch before exit
				if len(batch) > 0 {
					s.sendBatch(batch)
				}
				close(s.batchChan)
				return

			case event := <-s.eventChan:
				batch = append(batch, event)

				// Send batch when it's full
				if len(batch) >= FunnelBatchSize {
					s.sendBatch(batch)
					batch = make([]models.FunnelEvent, 0, FunnelBatchSize)
					ticker.Reset(FunnelFlushInterval)
				}

			case <-ticker.C:
				// Send batch on timer (even if not full)
				if len(batch) > 0 {
					s.sendBatch(batch)
					batch = make([]models.FunnelEvent, 0, FunnelBatchSize)
				}
			}
		}
	}()
}

// sendBatch sends a batch to the processing channel
func (s *FunnelService) sendBatch(batch []models.FunnelEvent) {
	batchCopy := make([]models.FunnelEvent, len(batch))
	copy(batchCopy, batch)

	select {
	case s.batchChan <- batchCopy:
		s.logger.Debug().Int("batch_size", len(batch)).Msg("Sent funnel batch for processing")
	case <-s.ctx.Done():
		return
	default:
		s.logger.Warn().Int("batch_size", len(batch)).Msg("Batch channel full, dropping funnel batch")
	}
}

// startBatchProcessor processes batches of funnel events
func (s *FunnelService) startBatchProcessor() {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()

		for {
			select {
			case <-s.ctx.Done():
				return

			case batch, ok := <-s.batchChan:
				if !ok {
					return
				}

				s.processBatch(batch)
			}
		}
	}()
}

// processBatch processes a batch of funnel events
func (s *FunnelService) processBatch(events []models.FunnelEvent) {
	if len(events) == 0 {
		return
	}

	start := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Process batch - validate and store events
	validEvents := make([]models.FunnelEvent, 0, len(events))

	for _, event := range events {
		// Basic validation - funnel existence check would be too expensive for batches
		if event.FunnelID != uuid.Nil && event.WebsiteID != "" && event.VisitorID != "" {
			validEvents = append(validEvents, event)
		} else {
			s.logger.Warn().
				Str("funnel_id", event.FunnelID.String()).
				Str("website_id", event.WebsiteID).
				Str("visitor_id", event.VisitorID).
				Msg("Invalid funnel event in batch, skipping")
		}
	}

	if len(validEvents) == 0 {
		s.logger.Warn().Msg("No valid events in batch")
		return
	}

	// Bulk insert valid events
	err := s.repo.CreateFunnelEventsBatch(ctx, validEvents)
	if err != nil {
		s.logger.Error().Err(err).
			Int("batch_size", len(validEvents)).
			Msg("Failed to process funnel events batch")
		return
	}

	duration := time.Since(start)
	s.logger.Info().
		Int("total_events", len(events)).
		Int("valid_events", len(validEvents)).
		Int("invalid_events", len(events)-len(validEvents)).
		Dur("duration", duration).
		Msg("Successfully processed funnel events batch")
}

// TrackFunnelEventAsync - Add event to batch queue (NEW: Async processing)
func (s *FunnelService) TrackFunnelEventAsync(event models.FunnelEvent) error {
	s.shutdownMu.RLock()
	defer s.shutdownMu.RUnlock()

	if s.isShutdown {
		return fmt.Errorf("service is shutting down")
	}

	select {
	case s.eventChan <- event:
		return nil
	case <-s.ctx.Done():
		return fmt.Errorf("service is shutting down")
	default:
		s.logger.Warn().Msg("Funnel event channel full, dropping event")
		return fmt.Errorf("event channel full")
	}
}

// Shutdown gracefully shuts down the funnel service
func (s *FunnelService) Shutdown() {
	s.shutdownMu.Lock()
	defer s.shutdownMu.Unlock()

	if s.isShutdown {
		return
	}

	s.logger.Info().Msg("Shutting down funnel service")
	s.isShutdown = true
	s.cancel()

	// Wait for all goroutines to finish with timeout
	done := make(chan struct{})
	go func() {
		s.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		s.logger.Info().Msg("Funnel service shutdown completed")
	case <-time.After(10 * time.Second):
		s.logger.Warn().Msg("Funnel service shutdown timed out")
	}
}
