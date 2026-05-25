package controller

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

func githubCopilotOAuthSessionKey(channelID int, field string) string {
	return fmt.Sprintf("github_copilot_oauth_%s_%d", field, channelID)
}

func StartGitHubCopilotOAuth(c *gin.Context) {
	startGitHubCopilotOAuthWithChannelID(c, 0)
}

func StartGitHubCopilotOAuthForChannel(c *gin.Context) {
	channelID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, fmt.Errorf("invalid channel id: %w", err))
		return
	}
	startGitHubCopilotOAuthWithChannelID(c, channelID)
}

func startGitHubCopilotOAuthWithChannelID(c *gin.Context, channelID int) {
	channelProxy, ok := getGitHubCopilotOAuthChannelProxy(c, channelID)
	if !ok {
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
	defer cancel()

	flow, err := service.CreateGitHubCopilotDeviceCode(ctx, channelProxy)
	if err != nil {
		common.SysError("failed to start github copilot device flow: " + err.Error())
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "启动授权失败，请重试"})
		return
	}

	now := time.Now()
	session := sessions.Default(c)
	session.Set(githubCopilotOAuthSessionKey(channelID, "device_code"), flow.DeviceCode)
	session.Set(githubCopilotOAuthSessionKey(channelID, "expires_at"), now.Add(time.Duration(flow.ExpiresIn)*time.Second).Unix())
	session.Set(githubCopilotOAuthSessionKey(channelID, "interval"), flow.Interval)
	session.Set(githubCopilotOAuthSessionKey(channelID, "created_at"), now.Unix())
	_ = session.Save()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"authorize_url":    flow.VerificationURL,
			"verification_url": flow.VerificationURL,
			"user_code":        flow.UserCode,
			"expires_in":       flow.ExpiresIn,
			"interval":         flow.Interval,
		},
	})
}

func CompleteGitHubCopilotOAuth(c *gin.Context) {
	completeGitHubCopilotOAuthWithChannelID(c, 0)
}

func CompleteGitHubCopilotOAuthForChannel(c *gin.Context) {
	channelID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, fmt.Errorf("invalid channel id: %w", err))
		return
	}
	completeGitHubCopilotOAuthWithChannelID(c, channelID)
}

func completeGitHubCopilotOAuthWithChannelID(c *gin.Context, channelID int) {
	channelProxy, ok := getGitHubCopilotOAuthChannelProxy(c, channelID)
	if !ok {
		return
	}

	session := sessions.Default(c)
	deviceCode, _ := session.Get(githubCopilotOAuthSessionKey(channelID, "device_code")).(string)
	expiresAt := sessionValueAsInt64(session.Get(githubCopilotOAuthSessionKey(channelID, "expires_at")))
	interval := sessionValueAsInt(session.Get(githubCopilotOAuthSessionKey(channelID, "interval")))
	if deviceCode == "" || expiresAt <= 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "oauth flow not started or session expired"})
		return
	}

	deadline := time.Unix(expiresAt, 0)
	remaining := time.Until(deadline)
	if remaining <= 0 {
		clearGitHubCopilotOAuthSession(session, channelID)
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "device code expired, please restart authorization"})
		return
	}
	if remaining > 65*time.Second {
		remaining = 65 * time.Second
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), remaining)
	defer cancel()

	githubToken, err := service.WaitGitHubCopilotDeviceAccessToken(ctx, deviceCode, interval, channelProxy)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrGitHubCopilotDeviceAuthorizationPending):
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "authorization pending, please complete GitHub authorization first"})
		case errors.Is(err, service.ErrGitHubCopilotDeviceAccessDenied):
			clearGitHubCopilotOAuthSession(session, channelID)
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "authorization denied"})
		case errors.Is(err, service.ErrGitHubCopilotDeviceExpired):
			clearGitHubCopilotOAuthSession(session, channelID)
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "device code expired, please restart authorization"})
		default:
			common.SysError("failed to complete github copilot device flow: " + err.Error())
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "授权失败，请重试"})
		}
		return
	}

	encoded, err := common.Marshal(gin.H{"github_token": githubToken})
	if err != nil {
		common.ApiError(c, err)
		return
	}

	clearGitHubCopilotOAuthSession(session, channelID)

	if channelID > 0 {
		if err := model.DB.Model(&model.Channel{}).Where("id = ?", channelID).Update("key", string(encoded)).Error; err != nil {
			common.ApiError(c, err)
			return
		}
		model.InitChannelCache()
		service.ResetProxyClientCache()
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "saved",
			"data": gin.H{
				"channel_id":   channelID,
				"channel_type": constant.ChannelTypeGitHubCopilot,
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "generated",
		"data": gin.H{
			"key": string(encoded),
		},
	})
}

func getGitHubCopilotOAuthChannelProxy(c *gin.Context, channelID int) (string, bool) {
	if channelID <= 0 {
		return "", true
	}
	ch, err := model.GetChannelById(channelID, false)
	if err != nil {
		common.ApiError(c, err)
		return "", false
	}
	if ch == nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "channel not found"})
		return "", false
	}
	if ch.Type != constant.ChannelTypeGitHubCopilot {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "channel type is not GitHub Copilot"})
		return "", false
	}
	return ch.GetSetting().Proxy, true
}

func clearGitHubCopilotOAuthSession(session sessions.Session, channelID int) {
	session.Delete(githubCopilotOAuthSessionKey(channelID, "device_code"))
	session.Delete(githubCopilotOAuthSessionKey(channelID, "expires_at"))
	session.Delete(githubCopilotOAuthSessionKey(channelID, "interval"))
	session.Delete(githubCopilotOAuthSessionKey(channelID, "created_at"))
	_ = session.Save()
}

func sessionValueAsInt(value any) int {
	switch v := value.(type) {
	case int:
		return v
	case int64:
		return int(v)
	case float64:
		return int(v)
	default:
		return 0
	}
}

func sessionValueAsInt64(value any) int64 {
	switch v := value.(type) {
	case int:
		return int64(v)
	case int64:
		return v
	case float64:
		return int64(v)
	default:
		return 0
	}
}
