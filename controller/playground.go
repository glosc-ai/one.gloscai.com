package controller

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func Playground(c *gin.Context) {
	var newAPIError *types.NewAPIError

	defer func() {
		if newAPIError != nil {
			c.JSON(newAPIError.StatusCode, gin.H{
				"error": newAPIError.ToOpenAIError(),
			})
		}
	}()

	useAccessToken := c.GetBool("use_access_token")
	if useAccessToken {
		newAPIError = types.NewError(errors.New("暂不支持使用 access token"), types.ErrorCodeAccessDenied, types.ErrOptionWithSkipRetry())
		return
	}

	relayInfo, err := relaycommon.GenRelayInfo(c, types.RelayFormatOpenAI, nil, nil)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		return
	}

	userId := c.GetInt("id")

	// Write user context to ensure acceptUnsetRatio is available
	userCache, err := model.GetUserCache(userId)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
		return
	}
	userCache.WriteContext(c)

	tempToken := &model.Token{
		UserId: userId,
		Name:   fmt.Sprintf("playground-%s", relayInfo.UsingGroup),
		Group:  relayInfo.UsingGroup,
	}
	_ = middleware.SetupContextForToken(c, tempToken)

	Relay(c, types.RelayFormatOpenAI)
}

// setupPlaygroundToken bridges dashboard session auth to the relay layer by
// constructing a temporary in-memory token bound to the current user/group.
// Returns a NewAPIError when the session cannot be used (e.g. access token).
func setupPlaygroundToken(c *gin.Context, format types.RelayFormat) *types.NewAPIError {
	if c.GetBool("use_access_token") {
		return types.NewError(errors.New("暂不支持使用 access token"), types.ErrorCodeAccessDenied, types.ErrOptionWithSkipRetry())
	}

	relayInfo, err := relaycommon.GenRelayInfo(c, format, nil, nil)
	if err != nil {
		return types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}

	userId := c.GetInt("id")
	userCache, err := model.GetUserCache(userId)
	if err != nil {
		return types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
	}
	userCache.WriteContext(c)

	tempToken := &model.Token{
		UserId: userId,
		Name:   fmt.Sprintf("playground-%s", relayInfo.UsingGroup),
		Group:  relayInfo.UsingGroup,
	}
	_ = middleware.SetupContextForToken(c, tempToken)
	return nil
}

// PlaygroundImage proxies dashboard image-generation requests through the relay
// using the current user's session (no API key required).
func PlaygroundImage(c *gin.Context) {
	if apiErr := setupPlaygroundToken(c, types.RelayFormatOpenAIImage); apiErr != nil {
		c.JSON(apiErr.StatusCode, gin.H{"error": apiErr.ToOpenAIError()})
		return
	}
	Relay(c, types.RelayFormatOpenAIImage)
}

// PlaygroundVideo proxies dashboard video-generation submissions through the
// relay task system using the current user's session.
func PlaygroundVideo(c *gin.Context) {
	if apiErr := setupPlaygroundToken(c, types.RelayFormatTask); apiErr != nil {
		c.JSON(apiErr.StatusCode, gin.H{"error": apiErr.ToOpenAIError()})
		return
	}
	RelayTask(c)
}

// PlaygroundVideoFetch proxies dashboard video-task status polling through the
// relay task system using the current user's session.
func PlaygroundVideoFetch(c *gin.Context) {
	if apiErr := setupPlaygroundToken(c, types.RelayFormatTask); apiErr != nil {
		c.JSON(apiErr.StatusCode, gin.H{"error": apiErr.ToOpenAIError()})
		return
	}
	RelayTaskFetch(c)
}

// PlaygroundAudioSpeech proxies dashboard text-to-speech (TTS) requests through
// the relay using the current user's session (no API key required).
func PlaygroundAudioSpeech(c *gin.Context) {
	if apiErr := setupPlaygroundToken(c, types.RelayFormatOpenAIAudio); apiErr != nil {
		c.JSON(apiErr.StatusCode, gin.H{"error": apiErr.ToOpenAIError()})
		return
	}
	Relay(c, types.RelayFormatOpenAIAudio)
}

// PlaygroundAudioTranscription proxies dashboard speech-to-text (STT)
// transcription requests through the relay using the current user's session
// (no API key required).
func PlaygroundAudioTranscription(c *gin.Context) {
	if apiErr := setupPlaygroundToken(c, types.RelayFormatOpenAIAudio); apiErr != nil {
		c.JSON(apiErr.StatusCode, gin.H{"error": apiErr.ToOpenAIError()})
		return
	}
	Relay(c, types.RelayFormatOpenAIAudio)
}
