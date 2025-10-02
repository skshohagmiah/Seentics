package cache

import "time"

// Cache TTL constants
const (
	DOMAIN_CACHE_TTL     = 1 * time.Hour
	SITEID_CACHE_TTL     = 1 * time.Hour
	TOKEN_CACHE_TTL      = 15 * time.Minute
	WEBSITE_CACHE_TTL    = 30 * time.Minute
	VALIDATION_CACHE_TTL = 30 * time.Minute
)

// ValidationRequest for the website validation endpoint
type ValidationRequest struct {
	WebsiteID string `json:"websiteId"`
	Domain    string `json:"domain"`
}

// ValidationResponse from the website validation endpoint
type ValidationResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    struct {
		WebsiteID      string   `json:"websiteId"`
		Domain         string   `json:"domain"`
		WebsiteName    string   `json:"websiteName"`
		IsVerified     bool     `json:"isVerified"`
		AllowedOrigins []string `json:"allowedOrigins,omitempty"`
	} `json:"data"`
}
