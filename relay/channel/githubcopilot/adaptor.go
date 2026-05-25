package githubcopilot

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/claude"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

type Adaptor struct {
	openaiAdaptor openai.Adaptor
	claudeAdaptor claude.Adaptor
}

const githubCopilotTokenContextKey = "github_copilot_token_result"

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
	a.openaiAdaptor.Init(info)
}

func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	return a.openaiAdaptor.ConvertGeminiRequest(c, info, request)
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	return a.claudeAdaptor.ConvertClaudeRequest(c, info, request)
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	return nil, errors.New("github copilot channel: audio endpoint not supported")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	return nil, errors.New("github copilot channel: image endpoint not supported")
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("github copilot channel: request is nil")
	}
	if isGitHubCopilotClaudeModel(request.Model) || (info != nil && isGitHubCopilotClaudeModel(info.UpstreamModelName)) {
		claudeRequest, err := claude.RequestOpenAI2ClaudeMessage(c, *request)
		if err != nil {
			return nil, err
		}
		if info != nil {
			info.UpstreamModelName = claudeRequest.Model
		}
		return claudeRequest, nil
	}

	converted, err := a.openaiAdaptor.ConvertOpenAIRequest(c, info, request)
	if err != nil {
		return nil, err
	}
	openAIRequest, ok := converted.(*dto.GeneralOpenAIRequest)
	if !ok {
		return converted, nil
	}
	openAIRequest.StreamOptions = nil
	openAIRequest.Store = nil
	openAIRequest.ServiceTier = nil
	return openAIRequest, nil
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, errors.New("github copilot channel: rerank endpoint not supported")
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return request, nil
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	return a.openaiAdaptor.ConvertOpenAIResponsesRequest(c, info, request)
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	tokenResult, err := resolveGitHubCopilotToken(c, info)
	if err != nil {
		return nil, err
	}
	info.ChannelBaseUrl = service.ResolveGitHubCopilotBaseURL(info.ChannelBaseUrl, tokenResult.BaseURL)
	c.Set(githubCopilotTokenContextKey, tokenResult)
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	if shouldUseGitHubCopilotClaudeEndpoint(info) {
		return a.claudeAdaptor.DoResponse(c, resp, info)
	}
	return a.openaiAdaptor.DoResponse(c, resp, info)
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	baseURL := service.ResolveGitHubCopilotBaseURL(info.ChannelBaseUrl, "")
	if shouldUseGitHubCopilotClaudeEndpoint(info) {
		return relaycommon.GetFullRequestURL(baseURL, "/anthropic/v1/messages", info.ChannelType), nil
	}
	switch info.RelayMode {
	case relayconstant.RelayModeResponses:
		return relaycommon.GetFullRequestURL(baseURL, "/responses", info.ChannelType), nil
	case relayconstant.RelayModeResponsesCompact:
		return relaycommon.GetFullRequestURL(baseURL, "/responses/compact", info.ChannelType), nil
	case relayconstant.RelayModeEmbeddings:
		return relaycommon.GetFullRequestURL(baseURL, "/embeddings", info.ChannelType), nil
	case relayconstant.RelayModeChatCompletions, relayconstant.RelayModeGemini:
		return relaycommon.GetFullRequestURL(baseURL, "/chat/completions", info.ChannelType), nil
	default:
		return "", fmt.Errorf("github copilot channel: endpoint not supported")
	}
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)

	tokenResult, err := resolveGitHubCopilotToken(c, info)
	if err != nil {
		return err
	}

	service.SetGitHubCopilotAPIHeaders(req, tokenResult.Token, info.IsStream)
	if shouldUseGitHubCopilotClaudeEndpoint(info) && req.Get("anthropic-version") == "" {
		req.Set("anthropic-version", "2023-06-01")
	}
	if req.Get("x-initiator") == "" {
		req.Set("x-initiator", "user")
	}

	return nil
}

func resolveGitHubCopilotToken(c *gin.Context, info *relaycommon.RelayInfo) (*service.GitHubCopilotTokenResult, error) {
	if value, exists := c.Get(githubCopilotTokenContextKey); exists {
		if tokenResult, ok := value.(*service.GitHubCopilotTokenResult); ok && tokenResult != nil && tokenResult.Token != "" {
			return tokenResult, nil
		}
	}
	return service.ResolveGitHubCopilotToken(c.Request.Context(), strings.TrimSpace(info.ApiKey), info.ChannelSetting.Proxy)
}

func shouldUseGitHubCopilotClaudeEndpoint(info *relaycommon.RelayInfo) bool {
	if info == nil {
		return false
	}
	if info.RelayFormat == types.RelayFormatClaude {
		return true
	}
	return info.RelayMode == relayconstant.RelayModeChatCompletions && isGitHubCopilotClaudeModel(info.UpstreamModelName)
}

func isGitHubCopilotClaudeModel(model string) bool {
	return strings.Contains(strings.ToLower(strings.TrimSpace(model)), "claude")
}
