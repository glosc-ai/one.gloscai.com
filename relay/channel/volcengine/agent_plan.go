package volcengine

import (
	"bufio"
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

const (
	agentPlanDefaultSpeaker = "zh_female_vv_uranus_bigtts"
	agentPlanTTSFinishCode  = 20000000
)

type AgentPlanAdaptor struct {
	Adaptor
}

type agentPlanTTSChunk struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    string `json:"data"`
}

func normalizeAgentPlanBaseURL(baseURL string) string {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if baseURL == "" {
		baseURL = AgentPlanDefaultBaseURL
	}
	if strings.HasSuffix(baseURL, "/api/plan/v3") {
		return baseURL
	}
	if strings.HasSuffix(baseURL, "/api/v3") {
		return strings.TrimSuffix(baseURL, "/api/v3") + "/api/plan/v3"
	}
	return baseURL + "/api/plan/v3"
}

func (a *AgentPlanAdaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	baseURL := normalizeAgentPlanBaseURL(info.ChannelBaseUrl)

	switch info.RelayMode {
	case relayconstant.RelayModeChatCompletions:
		return baseURL + "/chat/completions", nil
	case relayconstant.RelayModeEmbeddings:
		return baseURL + "/embeddings", nil
	case relayconstant.RelayModeImagesGenerations, relayconstant.RelayModeImagesEdits:
		return baseURL + "/images/generations", nil
	case relayconstant.RelayModeRerank:
		return baseURL + "/rerank", nil
	case relayconstant.RelayModeResponses:
		return baseURL + "/responses", nil
	case relayconstant.RelayModeAudioSpeech:
		return AgentPlanTTSHTTPURL, nil
	default:
		if info.RelayFormat == types.RelayFormatClaude {
			return baseURL + "/chat/completions", nil
		}
	}
	return "", fmt.Errorf("unsupported relay mode: %d", info.RelayMode)
}

func (a *AgentPlanAdaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	req.Set("Content-Type", "application/json")
	if req.Get("Accept") == "" && !info.IsStream {
		req.Set("Accept", "application/json")
	}

	if info.RelayMode == relayconstant.RelayModeAudioSpeech {
		req.Set("X-Api-Key", AgentPlanAPIKey(info.ApiKey))
		req.Set("X-Api-Resource-Id", "seed-tts-2.0")
		req.Set("X-Api-Request-Id", generateRequestID())
		req.Set("X-Control-Require-Usage-Tokens-Return", "*")
		return nil
	}

	req.Set("Authorization", "Bearer "+AgentPlanAPIKey(info.ApiKey))
	return nil
}

func (a *AgentPlanAdaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	if info.RelayMode != relayconstant.RelayModeAudioSpeech {
		return nil, errors.New("unsupported audio relay mode")
	}

	format := mapEncoding(request.ResponseFormat)
	c.Set(contextKeyResponseFormat, format)

	speaker := mapVoiceType(request.Voice)
	if speaker == "" {
		speaker = agentPlanDefaultSpeaker
	}

	audioParams := map[string]any{
		"format":      format,
		"sample_rate": 24000,
	}
	reqParams := map[string]any{
		"text":         request.Input,
		"speaker":      speaker,
		"audio_params": audioParams,
	}
	upstreamRequest := map[string]any{
		"req_params": reqParams,
	}

	if len(request.Metadata) > 0 {
		var metadata map[string]any
		if err := common.Unmarshal(request.Metadata, &metadata); err != nil {
			return nil, fmt.Errorf("error unmarshalling metadata to volcengine agent plan request: %w", err)
		}
		if metadataReqParams, ok := metadata["req_params"].(map[string]any); ok {
			for key, value := range metadataReqParams {
				reqParams[key] = value
			}
			if metadataAudioParams, ok := metadataReqParams["audio_params"].(map[string]any); ok {
				for key, value := range metadataAudioParams {
					audioParams[key] = value
				}
			}
		}
	}

	reqParams["text"] = request.Input
	if value, ok := reqParams["speaker"].(string); !ok || strings.TrimSpace(value) == "" {
		reqParams["speaker"] = speaker
	}
	if value, ok := audioParams["format"].(string); ok && strings.TrimSpace(value) != "" {
		format = strings.TrimSpace(value)
		c.Set(contextKeyResponseFormat, format)
	} else {
		audioParams["format"] = format
	}
	reqParams["audio_params"] = audioParams

	data, err := common.Marshal(upstreamRequest)
	if err != nil {
		return nil, fmt.Errorf("error marshalling volcengine agent plan request: %w", err)
	}
	return bytes.NewReader(data), nil
}

func (a *AgentPlanAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	if info.RelayMode == relayconstant.RelayModeAudioSpeech {
		format := c.GetString(contextKeyResponseFormat)
		return handleAgentPlanTTSResponse(c, resp, info, format)
	}

	adaptor := openai.Adaptor{}
	return adaptor.DoResponse(c, resp, info)
}

func (a *AgentPlanAdaptor) GetModelList() []string {
	return AgentPlanModelList
}

func (a *AgentPlanAdaptor) GetChannelName() string {
	return AgentPlanChannelName
}

func handleAgentPlanTTSResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo, format string) (usage any, err *types.NewAPIError) {
	if resp == nil {
		return nil, types.NewErrorWithStatusCode(
			errors.New("empty volcengine agent plan response"),
			types.ErrorCodeBadResponse,
			http.StatusInternalServerError,
		)
	}
	defer resp.Body.Close()

	var audioData bytes.Buffer
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 1024), 32*1024*1024)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		line = strings.TrimSpace(strings.TrimPrefix(line, "data:"))

		var chunk agentPlanTTSChunk
		if unmarshalErr := common.Unmarshal([]byte(line), &chunk); unmarshalErr != nil {
			return nil, types.NewErrorWithStatusCode(
				fmt.Errorf("failed to parse volcengine agent plan tts response: %w", unmarshalErr),
				types.ErrorCodeBadResponseBody,
				http.StatusInternalServerError,
			)
		}
		if chunk.Code == agentPlanTTSFinishCode {
			break
		}
		if chunk.Code > 0 {
			message := strings.TrimSpace(chunk.Message)
			if message == "" {
				message = fmt.Sprintf("volcengine agent plan tts error code %d", chunk.Code)
			}
			return nil, types.NewErrorWithStatusCode(
				errors.New(message),
				types.ErrorCodeBadResponse,
				http.StatusBadRequest,
			)
		}
		if chunk.Data == "" {
			continue
		}
		decoded, decodeErr := base64.StdEncoding.DecodeString(chunk.Data)
		if decodeErr != nil {
			return nil, types.NewErrorWithStatusCode(
				fmt.Errorf("failed to decode volcengine agent plan tts audio data: %w", decodeErr),
				types.ErrorCodeBadResponseBody,
				http.StatusInternalServerError,
			)
		}
		audioData.Write(decoded)
	}
	if scanErr := scanner.Err(); scanErr != nil {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("failed to read volcengine agent plan tts response: %w", scanErr),
			types.ErrorCodeReadResponseBodyFailed,
			http.StatusInternalServerError,
		)
	}
	if audioData.Len() == 0 {
		return nil, types.NewErrorWithStatusCode(
			errors.New("volcengine agent plan tts response contains no audio data"),
			types.ErrorCodeBadResponseBody,
			http.StatusInternalServerError,
		)
	}

	contentType := getContentTypeByEncoding(format)
	c.Header("Content-Type", contentType)
	c.Data(http.StatusOK, contentType, audioData.Bytes())

	promptTokens := info.GetEstimatePromptTokens()
	usage = &dto.Usage{
		PromptTokens:     promptTokens,
		CompletionTokens: 0,
		TotalTokens:      promptTokens,
	}
	return usage, nil
}
