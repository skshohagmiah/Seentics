package middleware

import (
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

// APIKeyMiddleware validates global API key for all requests
func APIKeyMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Get global API key from environment
		expectedAPIKey := os.Getenv("GLOBAL_API_KEY")
		if expectedAPIKey == "" {
			http.Error(w, "Service configuration error", http.StatusInternalServerError)
			return
		}

		// Get API key from request header
		providedAPIKey := r.Header.Get("X-API-Key")
		if providedAPIKey == "" {
			http.Error(w, "Authentication required", http.StatusUnauthorized)
			return
		}

		// Validate API key using simple string comparison
		if providedAPIKey != expectedAPIKey {
			http.Error(w, "Invalid authentication", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// GinAPIKeyMiddleware validates global API key for Gin requests
func GinAPIKeyMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get global API key from environment
		expectedAPIKey := os.Getenv("GLOBAL_API_KEY")
		if expectedAPIKey == "" {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Service configuration error"})
			c.Abort()
			return
		}

		// Get API key from request header
		providedAPIKey := c.GetHeader("X-API-Key")
		if providedAPIKey == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			c.Abort()
			return
		}

		// Validate API key using simple string comparison
		if providedAPIKey != expectedAPIKey {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authentication"})
			c.Abort()
			return
		}
		c.Next()
	}
}
