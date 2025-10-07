package utils

import (
	"net/http"
	"strings"
)

// Get client IP
func GetClientIP(r *http.Request) string {
	if ip := r.Header.Get("X-Forwarded-For"); ip != "" {
		return strings.Split(ip, ",")[0]
	}
	if ip := r.Header.Get("X-Real-IP"); ip != "" {
		return ip
	}
	if colon := strings.LastIndex(r.RemoteAddr, ":"); colon != -1 {
		return r.RemoteAddr[:colon]
	}
	return r.RemoteAddr
}

// Get rate limit identifier
func GetRateLimitID(r *http.Request, routeType string) string {
	switch routeType {
	case "public":
		// Public routes should ALWAYS be IP-based for security
		// This prevents abuse by rotating domains/siteIds
		return "ip:" + GetClientIP(r)
	case "protected":
		if userID := r.Header.Get("X-User-ID"); userID != "" {
			return "user:" + userID
		}
		return "ip:" + GetClientIP(r)
	default:
		return "ip:" + GetClientIP(r)
	}
}
