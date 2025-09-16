package repository

import (
	"analytics-app/models"
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// MainAnalyticsRepository combines all specialized analytics repositories
type MainAnalyticsRepository struct {
	dashboard      *DashboardAnalytics
	topPages       *TopPagesAnalytics
	topReferrers   *TopReferrersAnalytics
	topSources     *TopSourcesAnalytics
	topCountries   *TopCountriesAnalytics
	topBrowsers    *TopBrowsersAnalytics
	topDevices     *TopDevicesAnalytics
	topOS          *TopOSAnalytics
	trafficSummary *TrafficSummaryAnalytics
	timeSeries     *TimeSeriesAnalytics
	customEvents   *CustomEventsAnalytics
}

// NewMainAnalyticsRepository creates a new main analytics repository
func NewMainAnalyticsRepository(db *pgxpool.Pool) *MainAnalyticsRepository {
	return &MainAnalyticsRepository{
		dashboard:      NewDashboardAnalytics(db),
		topPages:       NewTopPagesAnalytics(db),
		topReferrers:   NewTopReferrersAnalytics(db),
		topSources:     NewTopSourcesAnalytics(db),
		topCountries:   NewTopCountriesAnalytics(db),
		topBrowsers:    NewTopBrowsersAnalytics(db),
		topDevices:     NewTopDevicesAnalytics(db),
		topOS:          NewTopOSAnalytics(db),
		trafficSummary: NewTrafficSummaryAnalytics(db),
		timeSeries:     NewTimeSeriesAnalytics(db),
		customEvents:   NewCustomEventsAnalytics(db),
	}
}

// Dashboard Analytics Methods
func (r *MainAnalyticsRepository) GetDashboardMetrics(ctx context.Context, websiteID string, days int) (*models.DashboardMetrics, error) {
	return r.dashboard.GetDashboardMetrics(ctx, websiteID, days)
}

func (r *MainAnalyticsRepository) GetComparisonMetrics(ctx context.Context, websiteID string, days int) (*models.ComparisonMetrics, error) {
	return r.dashboard.GetComparisonMetrics(ctx, websiteID, days)
}

func (r *MainAnalyticsRepository) GetUTMAnalytics(ctx context.Context, websiteID string, days int) (map[string]interface{}, error) {
	return r.dashboard.GetUTMAnalytics(ctx, websiteID, days)
}

// Top Pages Analytics Methods
func (r *MainAnalyticsRepository) GetTopPages(ctx context.Context, websiteID string, days int, limit int) ([]models.PageStat, error) {
	return r.topPages.GetTopPages(ctx, websiteID, days, limit)
}

func (r *MainAnalyticsRepository) GetTopPagesWithTimeBucket(ctx context.Context, websiteID string, days int, limit int) ([]models.PageStat, error) {
	return r.topPages.GetTopPagesWithTimeBucket(ctx, websiteID, days, limit)
}

func (r *MainAnalyticsRepository) GetPageUTMBreakdown(ctx context.Context, websiteID, pagePath string, days int) (map[string]interface{}, error) {
	return r.topPages.GetPageUTMBreakdown(ctx, websiteID, pagePath, days)
}

// Top Referrers Analytics Methods
func (r *MainAnalyticsRepository) GetTopReferrers(ctx context.Context, websiteID string, days int, limit int) ([]models.ReferrerStat, error) {
	return r.topReferrers.GetTopReferrers(ctx, websiteID, days, limit)
}

// Top Sources Analytics Methods
func (r *MainAnalyticsRepository) GetTopSources(ctx context.Context, websiteID string, days int, limit int) ([]models.SourceStat, error) {
	return r.topSources.GetTopSources(ctx, websiteID, days, limit)
}

// Top Countries Analytics Methods
func (r *MainAnalyticsRepository) GetTopCountries(ctx context.Context, websiteID string, days int, limit int) ([]models.CountryStat, error) {
	return r.topCountries.GetTopCountries(ctx, websiteID, days, limit)
}

// Top Browsers Analytics Methods
func (r *MainAnalyticsRepository) GetTopBrowsers(ctx context.Context, websiteID string, days int, limit int) ([]models.BrowserStat, error) {
	return r.topBrowsers.GetTopBrowsers(ctx, websiteID, days, limit)
}

// Top Devices Analytics Methods
func (r *MainAnalyticsRepository) GetTopDevices(ctx context.Context, websiteID string, days int, limit int) ([]models.DeviceStat, error) {
	return r.topDevices.GetTopDevices(ctx, websiteID, days, limit)
}

// Top OS Analytics Methods
func (r *MainAnalyticsRepository) GetTopOS(ctx context.Context, websiteID string, days int, limit int) ([]models.OSStat, error) {
	return r.topOS.GetTopOS(ctx, websiteID, days, limit)
}

// Traffic Summary Analytics Methods
func (r *MainAnalyticsRepository) GetTrafficSummary(ctx context.Context, websiteID string, days int) (*models.TrafficSummary, error) {
	return r.trafficSummary.GetTrafficSummary(ctx, websiteID, days)
}

// Time Series Analytics Methods
func (r *MainAnalyticsRepository) GetDailyStats(ctx context.Context, websiteID string, days int) ([]models.DailyStat, error) {
	return r.timeSeries.GetDailyStats(ctx, websiteID, days)
}

func (r *MainAnalyticsRepository) GetHourlyStats(ctx context.Context, websiteID string, days int, timezone string) ([]models.HourlyStat, error) {
	return r.timeSeries.GetHourlyStats(ctx, websiteID, days, timezone)
}

// Custom Events Analytics Methods
func (r *MainAnalyticsRepository) GetCustomEventStats(ctx context.Context, websiteID string, days int) ([]models.CustomEventStat, error) {
	return r.customEvents.GetCustomEventStats(ctx, websiteID, days)
}

// GetLiveVisitors returns the number of currently active visitors
func (r *MainAnalyticsRepository) GetLiveVisitors(ctx context.Context, websiteID string) (int, error) {
	query := `
		SELECT COUNT(DISTINCT visitor_id) as live_visitors
		FROM events
		WHERE website_id = $1 
		AND timestamp >= NOW() - INTERVAL '5 minutes'
		AND event_type = 'pageview'`

	var liveVisitors int
	err := r.dashboard.db.QueryRow(ctx, query, websiteID).Scan(&liveVisitors)
	if err != nil {
		return 0, err
	}

	return liveVisitors, nil
}
