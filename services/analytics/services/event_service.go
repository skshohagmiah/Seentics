package services

import (
	"analytics-app/models"
	"analytics-app/repository"
	"context"
	"fmt"
	"sync"
	"time"

	"analytics-app/utils"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
)

const (
	// Optimized batch collection for better throughput
	BatchSize     = 1000
	FlushInterval = 5 * time.Second // Increased from 2s to balance latency vs efficiency
)

type EventService struct {
	repo   *repository.EventRepository
	db     *pgxpool.Pool
	logger zerolog.Logger

	// Simple event channel for async processing
	eventChan chan models.Event
	batchChan chan []models.Event

	// Shutdown control
	ctx        context.Context
	cancel     context.CancelFunc
	wg         sync.WaitGroup
	isShutdown bool
	shutdownMu sync.RWMutex
}

func NewEventService(repo *repository.EventRepository, db *pgxpool.Pool, logger zerolog.Logger) *EventService {
	ctx, cancel := context.WithCancel(context.Background())

	service := &EventService{
		repo:      repo,
		db:        db,
		logger:    logger,
		eventChan: make(chan models.Event, 1000), // Buffered channel
		batchChan: make(chan []models.Event, 500),
		ctx:       ctx,
		cancel:    cancel,
	}

	// Start background workers
	service.startBatchCollector()
	service.startBatchProcessor()

	return service
}

// ensurePartitionExists checks if a partition exists for the given date and creates it if needed
func (s *EventService) ensurePartitionExists(ctx context.Context, targetDate time.Time) error {
	// Calculate partition boundaries (monthly partitions)
	startOfMonth := time.Date(targetDate.Year(), targetDate.Month(), 1, 0, 0, 0, 0, time.UTC)
	endOfMonth := startOfMonth.AddDate(0, 1, 0)

	partitionName := fmt.Sprintf("events_y%dm%02d", startOfMonth.Year(), startOfMonth.Month())
	startDate := startOfMonth.Format("2006-01-02")
	endDate := endOfMonth.Format("2006-01-02")

	// Check if partition already exists
	var exists bool
	checkQuery := `
		SELECT EXISTS (
			SELECT 1 FROM pg_tables 
			WHERE tablename = $1 AND schemaname = 'public'
		)
	`
	err := s.db.QueryRow(ctx, checkQuery, partitionName).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check if partition exists: %w", err)
	}

	if !exists {
		// Create the partition
		createQuery := fmt.Sprintf(
			"CREATE TABLE IF NOT EXISTS %s PARTITION OF events FOR VALUES FROM ('%s') TO ('%s')",
			partitionName, startDate, endDate,
		)
		_, err := s.db.Exec(ctx, createQuery)
		if err != nil {
			return fmt.Errorf("failed to create partition %s: %w", partitionName, err)
		}
		s.logger.Info().
			Str("partition_name", partitionName).
			Str("start_date", startDate).
			Str("end_date", endDate).
			Msg("Created new partition")
	}

	return nil
}

func (s *EventService) TrackEvent(ctx context.Context, event *models.Event) (*models.EventResponse, error) {
	// Quick shutdown check
	s.shutdownMu.RLock()
	if s.isShutdown {
		s.shutdownMu.RUnlock()
		return nil, fmt.Errorf("service is shutdown")
	}
	s.shutdownMu.RUnlock()

	// Validate and set defaults
	if event.EventType == "" {
		event.EventType = "pageview"
	}
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}

	// Enrich event data
	s.enrichEventData(ctx, event)

	// Try to send to channel (non-blocking)
	select {
	case s.eventChan <- *event:
		s.logger.Debug().
			Str("website_id", event.WebsiteID).
			Str("visitor_id", event.VisitorID).
			Str("event_type", event.EventType).
			Msg("Event queued")
	default:
		// Channel full, log warning but don't block
		s.logger.Warn().Msg("Event channel full, dropping event")
		return nil, fmt.Errorf("event queue full")
	}

	return &models.EventResponse{
		Status:    "accepted",
		EventID:   event.ID.String(),
		VisitorID: event.VisitorID,
		SessionID: event.SessionID,
	}, nil
}

func (s *EventService) TrackBatchEvents(ctx context.Context, req *models.BatchEventRequest) (*models.BatchEventResponse, error) {
	s.shutdownMu.RLock()
	if s.isShutdown {
		s.shutdownMu.RUnlock()
		return nil, fmt.Errorf("service is shutdown")
	}
	s.shutdownMu.RUnlock()

	if len(req.Events) == 0 {
		return &models.BatchEventResponse{
			Status:      "success",
			EventsCount: 0,
			ProcessedAt: time.Now().Unix(),
		}, nil
	}

	s.logger.Info().
		Str("site_id", req.SiteID).
		Int("events_count", len(req.Events)).
		Msg("Processing batch events")

	// Process and enrich all events
	for i := range req.Events {
		if req.Events[i].WebsiteID == "" {
			req.Events[i].WebsiteID = req.SiteID
		}
		if req.Events[i].EventType == "" {
			req.Events[i].EventType = "pageview"
		}
		if req.Events[i].Timestamp.IsZero() {
			req.Events[i].Timestamp = time.Now()
		}

		// Debug logging for each event
		s.logger.Debug().
			Str("website_id", req.Events[i].WebsiteID).
			Str("visitor_id", req.Events[i].VisitorID).
			Str("session_id", req.Events[i].SessionID).
			Str("event_type", req.Events[i].EventType).
			Str("page", req.Events[i].Page).
			Time("timestamp", req.Events[i].Timestamp).
			Msg("Processing individual event")

		s.enrichEventData(ctx, &req.Events[i])
	}

	// Send each event to the channel
	accepted := 0
	for _, event := range req.Events {
		select {
		case s.eventChan <- event:
			accepted++
			s.logger.Debug().
				Str("event_id", event.ID.String()).
				Str("event_type", event.EventType).
				Msg("Event queued successfully")
		default:
			s.logger.Warn().
				Str("event_type", event.EventType).
				Msg("Event channel full during batch")
			break
		}
	}

	s.logger.Info().
		Str("site_id", req.SiteID).
		Int("total_events", len(req.Events)).
		Int("accepted_events", accepted).
		Msg("Batch events processing completed")

	return &models.BatchEventResponse{
		Status:      "accepted",
		EventsCount: accepted,
		ProcessedAt: time.Now().Unix(),
	}, nil
}

// startBatchCollector collects events into small batches
func (s *EventService) startBatchCollector() {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()

		ticker := time.NewTicker(FlushInterval)
		defer ticker.Stop()

		batch := make([]models.Event, 0, BatchSize)

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
				if len(batch) >= BatchSize {
					s.sendBatch(batch)
					batch = make([]models.Event, 0, BatchSize)
					ticker.Reset(FlushInterval) // Reset timer
				}

			case <-ticker.C:
				// Send batch on timer (even if not full)
				if len(batch) > 0 {
					s.sendBatch(batch)
					batch = make([]models.Event, 0, BatchSize)
				}
			}
		}
	}()
}

// sendBatch sends a batch to the processor
func (s *EventService) sendBatch(batch []models.Event) {
	batchCopy := make([]models.Event, len(batch))
	copy(batchCopy, batch)

	select {
	case s.batchChan <- batchCopy:
		s.logger.Debug().Int("batch_size", len(batchCopy)).Msg("Batch sent for processing")
	case <-s.ctx.Done():
		s.logger.Warn().Msg("Batch dropped during shutdown")
	default:
		s.logger.Warn().Msg("Batch channel full, dropping batch")
	}
}

// startBatchProcessor processes batches and writes to DB
func (s *EventService) startBatchProcessor() {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()

		for {
			select {
			case <-s.ctx.Done():
				// Process remaining batches
				for {
					select {
					case batch := <-s.batchChan:
						s.processBatch(batch)
					default:
						return
					}
				}

			case batch := <-s.batchChan:
				s.processBatch(batch)
			}
		}
	}()
}

// processBatch writes a batch to the database
func (s *EventService) processBatch(batch []models.Event) {
	if len(batch) == 0 {
		return
	}

	start := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Ensure partitions exist for all events in the batch
	uniqueDates := make(map[string]time.Time)
	for _, event := range batch {
		if !event.Timestamp.IsZero() {
			dateKey := event.Timestamp.Format("2006-01")
			uniqueDates[dateKey] = event.Timestamp
		}
	}

	// Create partitions for unique months
	for _, eventTime := range uniqueDates {
		if err := s.ensurePartitionExists(ctx, eventTime); err != nil {
			s.logger.Warn().
				Err(err).
				Time("event_time", eventTime).
				Msg("Failed to ensure partition exists, continuing anyway")
		}
	}

	// Log event types and website IDs in the batch
	eventTypes := make(map[string]int)
	websiteIDs := make(map[string]int)
	for _, event := range batch {
		eventTypes[event.EventType]++
		websiteIDs[event.WebsiteID]++
	}

	s.logger.Info().
		Int("events_count", len(batch)).
		Interface("event_types", eventTypes).
		Interface("website_ids", websiteIDs).
		Msg("Processing batch")

	result, err := s.repo.CreateBatch(ctx, batch)
	if err != nil {
		s.logger.Error().
			Err(err).
			Int("events_count", len(batch)).
			Interface("event_types", eventTypes).
			Msg("Failed to process batch")
		return
	}

	duration := time.Since(start)
	s.logger.Info().
		Int("processed", result.Processed).
		Int("failed", result.Failed).
		Int("total", result.Total).
		Dur("duration", duration).
		Interface("event_types", eventTypes).
		Msg("Batch processed successfully")

	if result.Failed > 0 {
		s.logger.Warn().
			Int("failed_count", result.Failed).
			Interface("errors", result.Errors).
			Msg("Some events failed in batch")
	}
}

// Shutdown gracefully shuts down the service
func (s *EventService) Shutdown(timeout time.Duration) error {
	s.logger.Info().Msg("Shutting down event service")

	// Mark as shutdown to prevent new events
	s.shutdownMu.Lock()
	s.isShutdown = true
	s.shutdownMu.Unlock()

	// Signal shutdown
	s.cancel()

	// Wait for workers to finish with timeout
	done := make(chan struct{})
	go func() {
		s.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		s.logger.Info().Msg("Event service shutdown completed")
		return nil
	case <-time.After(timeout):
		s.logger.Warn().Msg("Event service shutdown timed out")
		return fmt.Errorf("shutdown timeout exceeded")
	}
}

func (s *EventService) GetEvents(ctx context.Context, websiteID string, limit int, offset int) ([]models.Event, error) {
	if websiteID == "" {
		return nil, fmt.Errorf("website_id is required")
	}
	if limit <= 0 || limit > 10000 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	return s.repo.GetByWebsiteID(ctx, websiteID, limit, offset)
}

// GetStats returns service statistics
func (s *EventService) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"event_queue_size": len(s.eventChan),
		"event_queue_cap":  cap(s.eventChan),
		"batch_queue_size": len(s.batchChan),
		"batch_queue_cap":  cap(s.batchChan),
		"batch_size":       BatchSize,
		"flush_interval":   FlushInterval.String(),
	}
}

func (s *EventService) enrichEventData(ctx context.Context, event *models.Event) {
	// Parse user agent if provided
	if event.UserAgent != nil && *event.UserAgent != "" {
		if (event.Browser == nil || *event.Browser == "") ||
			(event.Device == nil || *event.Device == "") ||
			(event.OS == nil || *event.OS == "") {

			uaInfo := utils.ParseUserAgent(*event.UserAgent)

			if event.Browser == nil || *event.Browser == "" {
				event.Browser = &uaInfo.Browser
			}
			if event.Device == nil || *event.Device == "" {
				event.Device = &uaInfo.Device
			}
			if event.OS == nil || *event.OS == "" {
				event.OS = &uaInfo.OS
			}
		}
	}

	// Get comprehensive geolocation from IP
	if (event.Country == nil || *event.Country == "") &&
		(event.IPAddress != nil && *event.IPAddress != "") {

		location := utils.GetLocationFromIP(*event.IPAddress)

		// Set country information - use full country name for the country field
		if event.Country == nil || *event.Country == "" {
			// Use full country name for the country field
			if location.Country != "" {
				event.Country = &location.Country
			}
		}
		if event.CountryCode == nil || *event.CountryCode == "" {
			event.CountryCode = &location.CountryCode
		}

		// Set city information
		if event.City == nil || *event.City == "" {
			event.City = &location.City
		}

		// Set continent information
		if event.Continent == nil || *event.Continent == "" {
			event.Continent = &location.Continent
		}

		// Set region information
		if event.Region == nil || *event.Region == "" {
			event.Region = &location.Region
		}
	}
}
