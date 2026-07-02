package helper

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestResolveIncomingBillingExprRequestInput(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Request.Header.Set("Content-Type", "application/json")

	body := []byte(`{"service_tier":"fast"}`)
	ctx.Request.Body = io.NopCloser(bytes.NewReader(body))
	ctx.Set(common.KeyRequestBody, body)

	info := &relaycommon.RelayInfo{
		RequestHeaders: map[string]string{"Content-Type": "application/json"},
	}

	input, err := ResolveIncomingBillingExprRequestInput(ctx, info)
	require.NoError(t, err)
	require.Equal(t, body, input.Body)
	require.Equal(t, "application/json", input.Headers["Content-Type"])
}

func TestResolveIncomingBillingExprRequestInputMultipart(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var requestBody bytes.Buffer
	writer := multipart.NewWriter(&requestBody)
	require.NoError(t, writer.WriteField("model", "whisper-1"))
	require.NoError(t, writer.WriteField("group", "vip"))
	require.NoError(t, writer.WriteField("response_format", "verbose_json"))
	part, err := writer.CreateFormFile("file", "sample.wav")
	require.NoError(t, err)
	_, err = part.Write([]byte("audio-data"))
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	body := append([]byte(nil), requestBody.Bytes()...)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(
		http.MethodPost,
		"/v1/audio/transcriptions",
		bytes.NewReader(body),
	)
	ctx.Request.Header.Set("Content-Type", writer.FormDataContentType())

	input, err := ResolveIncomingBillingExprRequestInput(ctx, nil)
	require.NoError(t, err)
	require.Equal(t, "whisper-1", gjson.GetBytes(input.Body, "model").String())
	require.Equal(t, "vip", gjson.GetBytes(input.Body, "group").String())
	require.Equal(t, "verbose_json", gjson.GetBytes(input.Body, "response_format").String())
	require.Equal(t, "sample.wav", gjson.GetBytes(input.Body, "file_name").String())
	require.Equal(t, float64(len("audio-data")), gjson.GetBytes(input.Body, "file_size").Float())
	require.Equal(t, "sample.wav", gjson.GetBytes(input.Body, "files.file.filename").String())

	form, err := common.ParseMultipartFormReusable(ctx)
	require.NoError(t, err)
	require.Equal(t, "whisper-1", form.Value["model"][0])
	require.Len(t, form.File["file"], 1)
}

func TestResolveIncomingBillingExprRequestInputAudioSpeechEstimate(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	body := []byte(`{"model":"tts-1","input":"hello world from the v1 api","voice":"alloy","speed":2}`)
	ctx.Request = httptest.NewRequest(
		http.MethodPost,
		"/v1/audio/speech",
		bytes.NewReader(body),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")

	input, err := ResolveIncomingBillingExprRequestInput(ctx, &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeAudioSpeech,
	})
	require.NoError(t, err)
	require.Equal(t, "hello world from the v1 api", gjson.GetBytes(input.Body, "input").String())
	require.Greater(t, gjson.GetBytes(input.Body, "estimated_duration").Float(), 0.0)
}

func TestResolveIncomingBillingExprRequestInputNormalizesTaskRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	body := []byte(`{"model":"veo-3.1","metadata":"{\"resolution\":\"4K\",\"durationSeconds\":8}"}`)
	ctx.Request = httptest.NewRequest(
		http.MethodPost,
		"/v1/videos",
		bytes.NewReader(body),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("task_request", relaycommon.TaskSubmitReq{
		Model: "veo-3.1",
		Metadata: map[string]interface{}{
			"resolution":      "4K",
			"durationSeconds": float64(8),
		},
	})

	input, err := ResolveIncomingBillingExprRequestInput(ctx, &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeVideoSubmit,
	})
	require.NoError(t, err)
	require.Equal(t, "4k", gjson.GetBytes(input.Body, "resolution").String())
	require.Equal(t, "4K", gjson.GetBytes(input.Body, "metadata.resolution").String())
	require.Equal(t, float64(8), gjson.GetBytes(input.Body, "metadata.durationSeconds").Float())
}

func TestResolveIncomingBillingExprRequestInputNormalizesTaskSize(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	body := []byte(`{"model":"sora-2-pro","seconds":"5","size":"1792x1024"}`)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("task_request", relaycommon.TaskSubmitReq{
		Model:   "sora-2-pro",
		Seconds: "5",
		Size:    "1792x1024",
	})

	input, err := ResolveIncomingBillingExprRequestInput(ctx, &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeVideoSubmit,
	})
	require.NoError(t, err)
	require.Equal(t, "1080p", gjson.GetBytes(input.Body, "resolution").String())
	require.Equal(t, "1792x1024", gjson.GetBytes(input.Body, "size").String())
	require.Equal(t, "5", gjson.GetBytes(input.Body, "seconds").String())
}

func TestNormalizeTaskBillingResolutionAliases(t *testing.T) {
	require.Equal(t, "480p", normalizeTaskBillingResolution("512P"))
	require.Equal(t, "720p", normalizeTaskBillingResolution("960*960"))
	require.Equal(t, "1080p", normalizeTaskBillingResolution("1632*1248"))
	require.Equal(t, "4k", normalizeTaskBillingResolution("3840x2160"))
}

func TestBuildBillingExprRequestInputFromRequest(t *testing.T) {
	request := &dto.GeneralOpenAIRequest{
		Model:  "gemini-3.1-pro-preview",
		Stream: lo.ToPtr(true),
		Messages: []dto.Message{
			{
				Role:    "user",
				Content: "hi",
			},
		},
		MaxTokens: lo.ToPtr(uint(3000)),
	}

	input, err := BuildBillingExprRequestInputFromRequest(request, map[string]string{
		"Content-Type": "application/json",
		"X-Test":       "1",
	})
	require.NoError(t, err)
	require.Equal(t, "application/json", input.Headers["Content-Type"])
	require.Equal(t, "1", input.Headers["X-Test"])
	require.True(t, gjson.GetBytes(input.Body, "stream").Bool())
	require.Equal(t, "user", gjson.GetBytes(input.Body, "messages.0.role").String())
	require.Equal(t, float64(3000), gjson.GetBytes(input.Body, "max_tokens").Float())
}
