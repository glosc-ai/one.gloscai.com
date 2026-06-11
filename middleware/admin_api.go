package middleware

import (
	"errors"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func getAdminAPIKeyFromRequest(c *gin.Context) string {
	key := strings.TrimSpace(c.GetHeader("X-Admin-Api-Key"))
	if key != "" {
		return key
	}
	auth := strings.TrimSpace(c.GetHeader("Authorization"))
	if strings.HasPrefix(strings.ToLower(auth), "bearer ") {
		return strings.TrimSpace(auth[7:])
	}
	return auth
}

func AdminAPIKeyAuth(scope string) gin.HandlerFunc {
	return func(c *gin.Context) {
		key, err := model.ValidateAdminAPIKey(getAdminAPIKeyFromRequest(c), scope)
		if err != nil {
			status := http.StatusUnauthorized
			message := "invalid admin api key"
			if errors.Is(err, gorm.ErrRecordNotFound) || errors.Is(err, model.ErrAdminAPIKeyInvalid) {
				status = http.StatusUnauthorized
			} else {
				status = http.StatusInternalServerError
				message = "database error"
			}
			c.JSON(status, gin.H{
				"success": false,
				"message": message,
			})
			c.Abort()
			return
		}
		c.Set("admin_api_key_id", key.Id)
		c.Next()
	}
}
