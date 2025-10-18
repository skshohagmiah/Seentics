package repository

import (
	"analytics-app/models"
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type FunnelRepository struct {
	db *pgxpool.Pool
}

func NewFunnelRepository(db *pgxpool.Pool) *FunnelRepository {
	return &FunnelRepository{db: db}
}

func (r *FunnelRepository) Create(ctx context.Context, funnel *models.Funnel) error {
	funnel.ID = uuid.New()
	funnel.CreatedAt = time.Now()
	funnel.UpdatedAt = time.Now()

	query := `
		INSERT INTO funnels (id, name, description, website_id, user_id, steps, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`

	_, err := r.db.Exec(ctx, query,
		funnel.ID, funnel.Name, funnel.Description, funnel.WebsiteID,
		funnel.UserID, funnel.Steps, funnel.IsActive, funnel.CreatedAt, funnel.UpdatedAt,
	)

	return err
}

func (r *FunnelRepository) GetByWebsiteID(ctx context.Context, websiteID string) ([]models.Funnel, error) {
	query := `
		SELECT id, name, description, website_id, user_id, steps, is_active, created_at, updated_at
		FROM funnels
		WHERE website_id = $1
		ORDER BY created_at DESC`

	rows, err := r.db.Query(ctx, query, websiteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var funnels []models.Funnel
	for rows.Next() {
		var funnel models.Funnel
		var stepsJSON []byte

		err := rows.Scan(
			&funnel.ID, &funnel.Name, &funnel.Description, &funnel.WebsiteID,
			&funnel.UserID, &stepsJSON, &funnel.IsActive, &funnel.CreatedAt, &funnel.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		// Manually unmarshal the steps JSON
		if stepsJSON != nil {
			err = json.Unmarshal(stepsJSON, &funnel.Steps)
			if err != nil {
				return nil, err
			}
		}

		funnels = append(funnels, funnel)
	}

	return funnels, rows.Err()
}

func (r *FunnelRepository) GetByID(ctx context.Context, funnelID uuid.UUID) (*models.Funnel, error) {
	query := `
		SELECT id, name, description, website_id, user_id, steps, is_active, created_at, updated_at
		FROM funnels
		WHERE id = $1`

	var funnel models.Funnel
	var stepsJSON []byte

	err := r.db.QueryRow(ctx, query, funnelID).Scan(
		&funnel.ID, &funnel.Name, &funnel.Description, &funnel.WebsiteID,
		&funnel.UserID, &stepsJSON, &funnel.IsActive, &funnel.CreatedAt, &funnel.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	// Manually unmarshal the steps JSON
	if stepsJSON != nil {
		err = json.Unmarshal(stepsJSON, &funnel.Steps)
		if err != nil {
			return nil, err
		}
	}

	return &funnel, nil
}

func (r *FunnelRepository) Update(ctx context.Context, funnelID uuid.UUID, funnel *models.Funnel) error {
	funnel.UpdatedAt = time.Now()

	query := `
		UPDATE funnels 
		SET name = $2, description = $3, steps = $4, is_active = $5, updated_at = $6
		WHERE id = $1`

	_, err := r.db.Exec(ctx, query,
		funnelID, funnel.Name, funnel.Description, funnel.Steps, funnel.IsActive, funnel.UpdatedAt,
	)

	return err
}

func (r *FunnelRepository) Delete(ctx context.Context, funnelID uuid.UUID) error {
	query := `DELETE FROM funnels WHERE id = $1`
	_, err := r.db.Exec(ctx, query, funnelID)
	return err
}

// CreateFunnelEventsBatch - Efficient batch insert for funnel events
func (r *FunnelRepository) CreateFunnelEventsBatch(ctx context.Context, events []models.FunnelEvent) error {
	if len(events) == 0 {
		return nil
	}

	// Prepare batch insert
	query := `
		INSERT INTO funnel_events (
			id, funnel_id, website_id, visitor_id, session_id, current_step, 
			started_at, last_activity, converted, properties, created_at
		) VALUES `
	
	values := make([]interface{}, 0, len(events)*11)
	placeholders := make([]string, 0, len(events))
	
	for i, event := range events {
		// Set defaults if not provided
		if event.ID == uuid.Nil {
			event.ID = uuid.New()
		}
		if event.CreatedAt.IsZero() {
			event.CreatedAt = time.Now()
		}
		now := time.Now()
		if event.StartedAt == nil {
			event.StartedAt = &now
		}
		if event.LastActivity == nil {
			event.LastActivity = &now
		}

		// Create placeholder
		placeholder := fmt.Sprintf("($%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d)",
			i*11+1, i*11+2, i*11+3, i*11+4, i*11+5, i*11+6,
			i*11+7, i*11+8, i*11+9, i*11+10, i*11+11)
		placeholders = append(placeholders, placeholder)
		
		// Marshal properties to JSON
		propertiesJSON, _ := json.Marshal(event.Properties)
		
		values = append(values,
			event.ID, event.FunnelID, event.WebsiteID, event.VisitorID, event.SessionID, event.CurrentStep,
			event.StartedAt, event.LastActivity, event.Converted, propertiesJSON, event.CreatedAt,
		)
	}
	
	query += strings.Join(placeholders, ", ")
	
	_, err := r.db.Exec(ctx, query, values...)
	return err
}

func (r *FunnelRepository) CreateFunnelEvent(ctx context.Context, event *models.FunnelEvent) error {
	event.ID = uuid.New()
	event.CreatedAt = time.Now()

	// Set StartedAt and LastActivity if they are nil
	now := time.Now()
	if event.StartedAt == nil {
		event.StartedAt = &now
	}
	if event.LastActivity == nil {
		event.LastActivity = &now
	}

	query := `
		INSERT INTO funnel_events (
			id, funnel_id, website_id, visitor_id, session_id, current_step, completed_steps,
			started_at, last_activity, converted, properties, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`

	_, err := r.db.Exec(ctx, query,
		event.ID, event.FunnelID, event.WebsiteID, event.VisitorID, event.SessionID,
		event.CurrentStep, models.IntSlice(event.CompletedSteps), event.StartedAt,
		event.LastActivity, event.Converted, event.Properties, event.CreatedAt,
	)

	return err
}

func (r *FunnelRepository) GetFunnelAnalytics(ctx context.Context, funnelID uuid.UUID, days int) (*models.FunnelAnalytics, error) {
	// Calculate analytics on-the-fly from funnel_events table
	query := `
		SELECT 
			COUNT(DISTINCT visitor_id) as total_starts,
			COUNT(DISTINCT visitor_id) FILTER (WHERE converted = true) as total_conversions,
			COUNT(DISTINCT visitor_id) FILTER (WHERE converted = true) * 100.0 / NULLIF(COUNT(DISTINCT visitor_id), 0) as conversion_rate,
			AVG(EXTRACT(EPOCH FROM (last_activity - started_at))) FILTER (WHERE converted = true) as avg_time_to_convert,
			AVG(EXTRACT(EPOCH FROM (last_activity - started_at))) FILTER (WHERE converted = false) as avg_time_to_abandon
		FROM funnel_events
		WHERE funnel_id = $1 
		AND created_at >= NOW() - INTERVAL '1 day' * $2`

	var totalStarts, totalConversions int
	var conversionRate, avgTimeToConvert, avgTimeToAbandon *float64

	err := r.db.QueryRow(ctx, query, funnelID, days).Scan(
		&totalStarts, &totalConversions, &conversionRate,
		&avgTimeToConvert, &avgTimeToAbandon,
	)

	if err != nil {
		return nil, err
	}

	// Calculate drop-off and abandonment rates
	var dropOffRate, abandonmentRate float64
	if conversionRate != nil {
		dropOffRate = 100.0 - *conversionRate
		abandonmentRate = 100.0 - *conversionRate
	}

	// Get website_id from the first event (assuming all events for a funnel have the same website_id)
	var websiteID string
	err = r.db.QueryRow(ctx,
		"SELECT website_id FROM funnel_events WHERE funnel_id = $1 LIMIT 1",
		funnelID).Scan(&websiteID)

	if err != nil {
		websiteID = "" // Set empty if no events found
	}

	// Convert float64 pointers to int pointers for the model
	var avgTimeToConvertInt, avgTimeToAbandonInt *int
	if avgTimeToConvert != nil {
		timeInt := int(*avgTimeToConvert)
		avgTimeToConvertInt = &timeInt
	}
	if avgTimeToAbandon != nil {
		timeInt := int(*avgTimeToAbandon)
		avgTimeToAbandonInt = &timeInt
	}

	// Handle conversion rate safely
	var conversionRateValue float64
	if conversionRate != nil {
		conversionRateValue = *conversionRate
	}

	analytics := &models.FunnelAnalytics{
		FunnelID:         funnelID,
		WebsiteID:        websiteID,
		Date:             time.Now().Format("2006-01-02"),
		TotalStarts:      totalStarts,
		TotalConversions: totalConversions,
		ConversionRate:   conversionRateValue,
		AvgTimeToConvert: avgTimeToConvertInt,
		AvgTimeToAbandon: avgTimeToAbandonInt,
		DropOffRate:      dropOffRate,
		AbandonmentRate:  abandonmentRate,
	}

	return analytics, nil
}

// GetDetailedFunnelAnalytics provides step-by-step funnel analysis
func (r *FunnelRepository) GetDetailedFunnelAnalytics(ctx context.Context, funnelID uuid.UUID, days int) (*models.DetailedFunnelAnalytics, error) {
	// Get the funnel definition first
	funnel, err := r.GetByID(ctx, funnelID)
	if err != nil {
		return nil, err
	}

	// Get step-by-step analytics
	stepAnalytics := make([]models.FunnelStepAnalytics, len(funnel.Steps))

	for i, step := range funnel.Steps {
		stepIndex := i + 1

		// Count visitors who reached this EXACT step (not beyond)
		stepQuery := `
			SELECT 
				COUNT(DISTINCT visitor_id) as visitors_reached,
				AVG(EXTRACT(EPOCH FROM (last_activity - started_at))) as avg_time_on_step
			FROM funnel_events
			WHERE funnel_id = $1 
			AND current_step = $2
			AND created_at >= NOW() - INTERVAL '1 day' * $3`

		var visitorsReached int
		var avgTimeOnStep *float64

		err := r.db.QueryRow(ctx, stepQuery, funnelID, stepIndex, days).Scan(
			&visitorsReached, &avgTimeOnStep,
		)

		if err != nil {
			visitorsReached = 0
			avgTimeOnStep = nil
		}

		// Calculate conversion rate to next step
		var conversionToNext float64
		if i < len(funnel.Steps)-1 {
			// Count visitors who reached the NEXT step (converted from current step)
			nextStepQuery := `
				SELECT COUNT(DISTINCT visitor_id) as visitors_to_next
				FROM funnel_events
				WHERE funnel_id = $1 
				AND current_step = $2
				AND created_at >= NOW() - INTERVAL '1 day' * $3`

			var visitorsToNext int
			err := r.db.QueryRow(ctx, nextStepQuery, funnelID, stepIndex+1, days).Scan(&visitorsToNext)
			if err == nil && visitorsReached > 0 {
				conversionToNext = (float64(visitorsToNext) / float64(visitorsReached)) * 100
			}
		} else {
			// Last step - check for conversions
			conversionQuery := `
				SELECT COUNT(DISTINCT visitor_id) as conversions
				FROM funnel_events
				WHERE funnel_id = $1 
				AND converted = true
				AND current_step = $2
				AND created_at >= NOW() - INTERVAL '1 day' * $3`

			var conversions int
			err := r.db.QueryRow(ctx, conversionQuery, funnelID, stepIndex, days).Scan(&conversions)
			if err == nil && visitorsReached > 0 {
				conversionToNext = (float64(conversions) / float64(visitorsReached)) * 100
			}
		}

		stepAnalytics[i] = models.FunnelStepAnalytics{
			StepID:          step.ID,
			StepName:        step.Name,
			StepOrder:       step.Order,
			VisitorsReached: visitorsReached,
			ConversionRate:  conversionToNext,
			DropOffRate:     100 - conversionToNext,
			AvgTimeOnStep:   avgTimeOnStep,
		}
	}

	// Get daily performance data
	dailyQuery := `
		SELECT 
			DATE(created_at) as date,
			COUNT(DISTINCT visitor_id) as total_starts,
			COUNT(DISTINCT visitor_id) FILTER (WHERE converted = true) as conversions,
			COUNT(DISTINCT visitor_id) FILTER (WHERE converted = true) * 100.0 / NULLIF(COUNT(DISTINCT visitor_id), 0) as conversion_rate
		FROM funnel_events
		WHERE funnel_id = $1 
		AND created_at >= NOW() - INTERVAL '1 day' * $2
		GROUP BY DATE(created_at)
		ORDER BY date DESC`

	rows, err := r.db.Query(ctx, dailyQuery, funnelID, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var dailyPerformance []models.DailyFunnelPerformance
	for rows.Next() {
		var dp models.DailyFunnelPerformance
		var date time.Time
		var conversionRate *float64

		err := rows.Scan(&date, &dp.TotalStarts, &dp.Conversions, &conversionRate)
		if err != nil {
			continue
		}

		dp.Date = date.Format("2006-01-02")
		if conversionRate != nil {
			dp.ConversionRate = *conversionRate
		}

		dailyPerformance = append(dailyPerformance, dp)
	}

	// Get cohort analysis data
	cohortQuery := `
		SELECT 
			DATE(started_at) as cohort_date,
			COUNT(DISTINCT visitor_id) as cohort_size,
			COUNT(DISTINCT visitor_id) FILTER (WHERE converted = true) as conversions,
			AVG(EXTRACT(EPOCH FROM (last_activity - started_at))) as avg_time_to_convert
		FROM funnel_events
		WHERE funnel_id = $1 
		AND started_at >= NOW() - INTERVAL '1 day' * $2
		GROUP BY DATE(started_at)
		ORDER BY cohort_date DESC`

	cohortRows, err := r.db.Query(ctx, cohortQuery, funnelID, days)
	if err != nil {
		return nil, err
	}
	defer cohortRows.Close()

	var cohortData []models.FunnelCohortData
	for cohortRows.Next() {
		var cd models.FunnelCohortData
		var cohortDate time.Time
		var avgTimeToConvert *float64

		err := cohortRows.Scan(&cohortDate, &cd.CohortSize, &cd.Conversions, &avgTimeToConvert)
		if err != nil {
			continue
		}

		cd.CohortDate = cohortDate.Format("2006-01-02")
		cd.ConversionRate = 0
		if cd.CohortSize > 0 {
			cd.ConversionRate = (float64(cd.Conversions) / float64(cd.CohortSize)) * 100
		}
		if avgTimeToConvert != nil {
			cd.AvgTimeToConvert = int(*avgTimeToConvert)
		}

		cohortData = append(cohortData, cd)
	}

	return &models.DetailedFunnelAnalytics{
		FunnelID:         funnelID,
		WebsiteID:        funnel.WebsiteID,
		StepAnalytics:    stepAnalytics,
		DailyPerformance: dailyPerformance,
		CohortData:       cohortData,
		DateRange:        days,
	}, nil
}

// GetTotalCount returns the total number of funnels
func (r *FunnelRepository) GetTotalCount(ctx context.Context) (int, error) {
	query := `SELECT COUNT(*) FROM funnels`
	var count int
	err := r.db.QueryRow(ctx, query).Scan(&count)
	return count, err
}

// GetRecentFunnels returns the most recently created funnels
func (r *FunnelRepository) GetRecentFunnels(ctx context.Context, limit int) ([]models.Funnel, error) {
	query := `
		SELECT id, name, description, website_id, user_id, steps, is_active, created_at, updated_at
		FROM funnels
		ORDER BY created_at DESC
		LIMIT $1`

	rows, err := r.db.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var funnels []models.Funnel
	for rows.Next() {
		var funnel models.Funnel
		var stepsJSON []byte

		err := rows.Scan(
			&funnel.ID, &funnel.Name, &funnel.Description, &funnel.WebsiteID,
			&funnel.UserID, &stepsJSON, &funnel.IsActive, &funnel.CreatedAt, &funnel.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		// Manually unmarshal the steps JSON
		if stepsJSON != nil {
			err = json.Unmarshal(stepsJSON, &funnel.Steps)
			if err != nil {
				return nil, err
			}
		}

		funnels = append(funnels, funnel)
	}

	return funnels, rows.Err()
}

// GetActiveFunnelCount returns the count of active funnels
func (r *FunnelRepository) GetActiveFunnelCount(ctx context.Context) (int, error) {
	query := `SELECT COUNT(*) FROM funnels WHERE is_active = true`
	var count int
	err := r.db.QueryRow(ctx, query).Scan(&count)
	return count, err
}
