package middleware

import (
	"os"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func CORS() gin.HandlerFunc {
	config := cors.DefaultConfig()
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"*"}

	// CORS_ALLOW_ORIGINS: comma-separated list of allowed origins.
	// When empty (default), all origins are allowed WITHOUT credentials —
	// safe for a pure API proxy where session cookies are not relied upon.
	// Example: CORS_ALLOW_ORIGINS=https://app.example.com,https://admin.example.com
	allowOriginsEnv := strings.TrimSpace(os.Getenv("CORS_ALLOW_ORIGINS"))
	if allowOriginsEnv != "" {
		var origins []string
		for _, o := range strings.Split(allowOriginsEnv, ",") {
			if trimmed := strings.TrimSpace(o); trimmed != "" {
				origins = append(origins, trimmed)
			}
		}
		if len(origins) > 0 {
			config.AllowOrigins = origins
			// Credentials (session cookies) are only safe when specific origins are listed.
			config.AllowCredentials = true
		}
	} else {
		// No explicit allow-list: permit all origins but do NOT send
		// Allow-Credentials, which would violate the CORS spec and enable
		// cross-site request forgery via credentialed requests.
		config.AllowAllOrigins = true
		config.AllowCredentials = false
	}

	return cors.New(config)
}

func Version() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-New-Api-Version", common.Version)
		c.Next()
	}
}
