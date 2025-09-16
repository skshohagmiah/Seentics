package utils

import (
	"analytics-app/models"
	"errors"
	"net/url"
	"strings"
)

// ValidateEvent validates an analytics event before processing
func ValidateEvent(event *models.Event) error {
	if event.WebsiteID == "" {
		return errors.New("website_id is required")
	}

	if event.VisitorID == "" {
		return errors.New("visitor_id is required")
	}

	if event.SessionID == "" {
		return errors.New("session_id is required")
	}

	if event.Page == "" {
		return errors.New("page is required")
	}

	// Validate page URL format
	if !isValidURL(event.Page) {
		return errors.New("page must be a valid URL")
	}

	// Validate event_type
	validEventTypes := []string{"pageview", "click", "form_submit", "download", "custom"}
	if event.EventType != "" && !contains(validEventTypes, event.EventType) {
		event.EventType = "custom" // Default to custom for unknown types
	}

	// Validate referrer URL if present
	if event.Referrer != nil && *event.Referrer != "" && !isValidURL(*event.Referrer) {
		return errors.New("referrer must be a valid URL")
	}

	// Validate numeric values
	if event.TimeOnPage != nil && *event.TimeOnPage < 0 {
		return errors.New("time_on_page must be non-negative")
	}

	return nil
}

// ValidateFunnel validates a funnel configuration
func ValidateFunnel(funnel *models.Funnel) error {
	if funnel.Name == "" {
		return errors.New("funnel name is required")
	}

	if funnel.WebsiteID == "" {
		return errors.New("website_id is required")
	}

	if len(funnel.Steps) == 0 {
		return errors.New("funnel must have at least one step")
	}

	// Validate each step
	for _, step := range funnel.Steps {
		if step.Name == "" {
			return errors.New("step name is required")
		}

		if step.Type == "" {
			return errors.New("step type is required")
		}

		validStepTypes := []string{"page", "event", "custom"}
		if !contains(validStepTypes, step.Type) {
			return errors.New("step has invalid type")
		}

		// Validate step conditions based on type
		switch step.Type {
		case "page":
			if step.Condition.Page == nil || *step.Condition.Page == "" {
				return errors.New("step of type 'page' requires page condition")
			}
		case "event":
			if step.Condition.Event == nil || *step.Condition.Event == "" {
				return errors.New("step of type 'event' requires event condition")
			}
		case "custom":
			if step.Condition.Custom == nil || *step.Condition.Custom == "" {
				return errors.New("step of type 'custom' requires custom condition")
			}
		}
	}

	return nil
}

// Helper functions
func isValidURL(urlString string) bool {
	// Allow relative URLs for pages
	if strings.HasPrefix(urlString, "/") {
		return true
	}

	// Validate full URLs
	u, err := url.Parse(urlString)
	if err != nil {
		return false
	}

	return u.Scheme != "" && u.Host != ""
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

// SanitizeString removes potentially harmful characters from string inputs
func SanitizeString(input string) string {
	// Remove null bytes and control characters
	cleaned := strings.ReplaceAll(input, "\x00", "")

	// Limit length to prevent abuse
	if len(cleaned) > 1000 {
		cleaned = cleaned[:1000]
	}

	return strings.TrimSpace(cleaned)
}

// NormalizeURL normalizes URLs for consistent analytics tracking
func NormalizeURL(rawURL string) string {
	if rawURL == "" {
		return ""
	}

	u, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}

	// Remove fragments and unnecessary query parameters
	u.Fragment = ""

	// Keep only meaningful query parameters
	query := u.Query()
	meaningfulParams := []string{"page", "id", "category", "product", "search", "q"}
	cleanQuery := url.Values{}

	for _, param := range meaningfulParams {
		if values := query[param]; len(values) > 0 {
			cleanQuery[param] = values
		}
	}

	u.RawQuery = cleanQuery.Encode()
	return u.String()
}
