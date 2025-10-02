package cache

import (
	"crypto/sha256"
	"fmt"
	"encoding/hex"
	"regexp"
	"strings"
)

// createSecureCacheKey creates a hashed cache key for sensitive data
func createSecureCacheKey(prefix string, parts ...string) string {
	combined := prefix
	for _, part := range parts {
		combined += ":" + part
	}
	hash := sha256.Sum256([]byte(combined))
	return prefix + "_hash:" + hex.EncodeToString(hash[:16]) // Use first 16 bytes for shorter key
}

// checkRateLimit checks if we should rate limit validation requests
func checkRateLimit(websiteID string) error {
	rateLimitKey := fmt.Sprintf("rate_limit:validation:%s", websiteID)
	
	// Check if rate limit key exists
	if _, err := GetCachedData(rateLimitKey); err == nil {
		return fmt.Errorf("rate limit exceeded for website %s", websiteID)
	}
	
	// Set rate limit (5 requests per minute per website)
	rateLimitData := map[string]interface{}{"count": 1}
	if err := CacheData(rateLimitKey, rateLimitData, 12); err != nil { // 12 seconds = 5 requests per minute
		// Failed to set rate limit, continue anyway
	}
	
	return nil
}

// sanitizeInput sanitizes input strings to prevent injection attacks
func sanitizeInput(input string) string {
	// Remove null bytes and control characters
	input = strings.ReplaceAll(input, "\x00", "")
	
	// Limit length to prevent memory exhaustion
	if len(input) > 255 {
		input = input[:255]
	}
	
	// Remove potentially dangerous characters
	dangerousChars := regexp.MustCompile(`[<>'";&|$\x00-\x1f\x7f-\x9f]`)
	input = dangerousChars.ReplaceAllString(input, "")
	
	return strings.TrimSpace(input)
}

// validateInputs validates all inputs before processing
func validateInputs(websiteID, domain string) error {
	if websiteID == "" {
		return fmt.Errorf("websiteID cannot be empty")
	}
	if domain == "" {
		return fmt.Errorf("domain cannot be empty")
	}
	
	// Validate websiteID format (should be alphanumeric with hyphens/underscores)
	websiteIDPattern := regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)
	if !websiteIDPattern.MatchString(websiteID) {
		return fmt.Errorf("invalid websiteID format")
	}
	
	// Validate domain format
	domainPattern := regexp.MustCompile(`^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	if !domainPattern.MatchString(domain) {
		return fmt.Errorf("invalid domain format")
	}
	
	return nil
}

// ValidateWebsite checks cache first, then calls the validation endpoint
func ValidateWebsite(websiteID, domain string) (map[string]interface{}, error) {
	// 0. Sanitize and validate inputs
	websiteID = sanitizeInput(websiteID)
	domain = sanitizeInput(domain)
	
	if err := validateInputs(websiteID, domain); err != nil {
		return nil, fmt.Errorf("input validation failed: %v", err)
	}
	
	cacheKey := CreateValidationCacheKey(websiteID, domain)

	// 1. Check Redis cache first
	if cachedData, err := GetCachedData(cacheKey); err == nil {
		return cachedData, nil
	}

	// 2. Rate limit validation requests to prevent abuse
	if err := checkRateLimit(websiteID); err != nil {
		return nil, err
	}

	// 3. Call validation service
	url := fmt.Sprintf("%s/api/v1/user/websites/validate", USER_SERVICE_URL)
	payload := ValidationRequest{
		WebsiteID: websiteID,
		Domain:    domain,
	}

	validationResp, err := makeValidationRequest(url, payload)
	if err != nil {
		return nil, err
	}

	if !validationResp.Success {
		return nil, fmt.Errorf("validation failed: %s", validationResp.Message)
	}

	// 3. Convert to map for compatibility with existing code
	websiteData := map[string]interface{}{
		"id":         validationResp.Data.WebsiteID,
		"domain":     validationResp.Data.Domain,
		"name":       validationResp.Data.WebsiteName,
		"isVerified": validationResp.Data.IsVerified,
		"isActive":   true, // If validation passed, website is active
	}

	// 4. Cache the result
	if err := CacheData(cacheKey, websiteData, VALIDATION_CACHE_TTL); err != nil {
		// Failed to cache validation data
	}

	return websiteData, nil
}

// ValidateWebsiteWithOrigin validates website and checks origin for tracking endpoints
func ValidateWebsiteWithOrigin(websiteID, domain, origin string) (map[string]interface{}, error) {
	// 0. Sanitize and validate inputs
	websiteID = sanitizeInput(websiteID)
	domain = sanitizeInput(domain)
	origin = sanitizeInput(origin)
	
	if err := validateInputs(websiteID, domain); err != nil {
		return nil, fmt.Errorf("input validation failed: %v", err)
	}
	
	if origin == "" {
		return nil, fmt.Errorf("origin cannot be empty for origin validation")
	}
	
	// Create secure hashed cache key that includes origin for security
	cacheKey := createSecureCacheKey("validation_origin", websiteID, domain, origin)

	// 1. Check Redis cache first (shorter TTL for origin validation)
	if cachedData, err := GetCachedData(cacheKey); err == nil {
		return cachedData, nil
	}

	// 2. Rate limit origin validation requests (more strict for security)
	if err := checkRateLimit(websiteID + "_origin"); err != nil {
		return nil, err
	}

	// 3. Call origin validation service
	url := fmt.Sprintf("%s/api/v1/user/websites/validate-origin", USER_SERVICE_URL)
	payload := map[string]interface{}{
		"websiteId": websiteID,
		"domain":    domain,
	}

	// Add origin header to the request
	headers := map[string]string{
		"Origin": origin,
	}

	validationResp, err := makeValidationRequestWithHeaders(url, payload, headers)
	if err != nil {
		return nil, err
	}

	if !validationResp.Success {
		return nil, fmt.Errorf("origin validation failed: %s", validationResp.Message)
	}

	// 3. Convert to map for compatibility with existing code
	websiteData := map[string]interface{}{
		"id":              validationResp.Data.WebsiteID,
		"domain":          validationResp.Data.Domain,
		"name":            validationResp.Data.WebsiteName,
		"isVerified":      validationResp.Data.IsVerified,
		"isActive":        true,
		"originValidated": true,
		"allowedOrigins":  validationResp.Data.AllowedOrigins,
	}

	// 4. Cache the result with shorter TTL for security (5 minutes)
	if err := CacheData(cacheKey, websiteData, 5*60); err != nil {
		// Failed to cache validation data
	}

	return websiteData, nil
}

// ValidateJWTToken checks cache first, then calls auth service
func ValidateJWTToken(token string) (map[string]interface{}, error) {
	// Hash token for security in cache key
	tokenHash := HashToken(token)
	cacheKey := fmt.Sprintf("token:%s", tokenHash)

	// 1. Check Redis cache first
	if cachedData, err := GetCachedData(cacheKey); err == nil {
		return cachedData, nil
	}

	// 2. Call auth service to validate token
	url := fmt.Sprintf("%s/api/v1/user/auth/validate", USER_SERVICE_URL)
	payload := map[string]interface{}{
		"token": token,
	}

	response, err := makeAuthServicePOST(url, payload)
	if err != nil {
		return nil, err
	}

	// Extract user data from response
	if !response["success"].(bool) {
		return nil, fmt.Errorf("token validation failed: %v", response["message"])
	}

	userData, ok := response["data"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid response format from auth service")
	}

	// 3. Cache the result with shorter TTL for security
	if err := CacheData(cacheKey, userData, TOKEN_CACHE_TTL); err != nil {
		// Failed to cache token data
	}

	return userData, nil
}

// ValidateWebsiteOwnership checks if user owns website
func ValidateWebsiteOwnership(userID, websiteID string) (map[string]interface{}, error) {
	cacheKey := fmt.Sprintf("website:%s", websiteID)

	// 1. Check Redis cache first
	if cachedData, err := GetCachedData(cacheKey); err == nil {
		// Check ownership
		if cachedUserID, ok := cachedData["userId"].(string); ok && cachedUserID == userID {
			return cachedData, nil
		} else {
			return nil, fmt.Errorf("user %s does not own website %s", userID, websiteID)
		}
	}

	// 2. Call auth service
	url := fmt.Sprintf("%s/api/v1/users/websites/%s", USER_SERVICE_URL, websiteID)
	websiteData, err := makeAuthServiceRequest(url)
	if err != nil {
		return nil, err
	}

	// 3. Verify ownership
	if websiteUserID, ok := websiteData["userId"].(string); !ok || websiteUserID != userID {
		return nil, fmt.Errorf("user %s does not own website %s", userID, websiteID)
	}

	// 4. Cache the result
	if err := CacheData(cacheKey, websiteData, WEBSITE_CACHE_TTL); err != nil {
		// Failed to cache website data
	}

	return websiteData, nil
}
