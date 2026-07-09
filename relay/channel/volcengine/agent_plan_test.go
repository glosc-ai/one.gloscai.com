package volcengine

import (
	"encoding/base64"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAgentPlanRequestURLUsesPlanBase(t *testing.T) {
	adaptor := &AgentPlanAdaptor{}

	tests := []struct {
		name      string
		baseURL   string
		relayMode int
		want      string
	}{
		{
			name:      "chat from root base",
			baseURL:   "https://ark.cn-beijing.volces.com",
			relayMode: relayconstant.RelayModeChatCompletions,
			want:      "https://ark.cn-beijing.volces.com/api/plan/v3/chat/completions",
		},
		{
			name:      "embedding from plan base",
			baseURL:   "https://ark.cn-beijing.volces.com/api/plan/v3/",
			relayMode: relayconstant.RelayModeEmbeddings,
			want:      "https://ark.cn-beijing.volces.com/api/plan/v3/embeddings",
		},
		{
			name:      "image generation from normal ark api base",
			baseURL:   "https://ark.cn-beijing.volces.com/api/v3",
			relayMode: relayconstant.RelayModeImagesGenerations,
			want:      "https://ark.cn-beijing.volces.com/api/plan/v3/images/generations",
		},
		{
			name:      "speech uses openspeech endpoint",
			baseURL:   "https://ark.cn-beijing.volces.com/api/plan/v3",
			relayMode: relayconstant.RelayModeAudioSpeech,
			want:      AgentPlanTTSHTTPURL,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			info := &relaycommon.RelayInfo{
				ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: test.baseURL},
				RelayMode:   test.relayMode,
			}

			got, err := adaptor.GetRequestURL(info)

			require.NoError(t, err)
			assert.Equal(t, test.want, got)
		})
	}
}

func TestAgentPlanSetupRequestHeader(t *testing.T) {
	adaptor := &AgentPlanAdaptor{}
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	chatHeader := http.Header{}
	err := adaptor.SetupRequestHeader(c, &chatHeader, &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{ApiKey: "agent-key"},
		RelayMode:   relayconstant.RelayModeChatCompletions,
	})
	require.NoError(t, err)
	assert.Equal(t, "Bearer agent-key", chatHeader.Get("Authorization"))
	assert.Empty(t, chatHeader.Get("X-Api-Key"))

	jsonCredentialHeader := http.Header{}
	err = adaptor.SetupRequestHeader(c, &jsonCredentialHeader, &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{ApiKey: `{"api_key":"agent-key","access_key":"ak","secret_key":"sk"}`},
		RelayMode:   relayconstant.RelayModeChatCompletions,
	})
	require.NoError(t, err)
	assert.Equal(t, "Bearer agent-key", jsonCredentialHeader.Get("Authorization"))

	speechHeader := http.Header{}
	err = adaptor.SetupRequestHeader(c, &speechHeader, &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiKey:            "agent-key",
			UpstreamModelName: "doubao-seed-tts-2.0",
		},
		RelayMode: relayconstant.RelayModeAudioSpeech,
	})
	require.NoError(t, err)
	assert.Equal(t, "agent-key", speechHeader.Get("X-Api-Key"))
	assert.Equal(t, "seed-tts-2.0", speechHeader.Get("X-Api-Resource-Id"))
	assert.NotEmpty(t, speechHeader.Get("X-Api-Request-Id"))
	assert.Empty(t, speechHeader.Get("Authorization"))
}

func TestAgentPlanConvertAudioRequestBuildsTTSParams(t *testing.T) {
	adaptor := &AgentPlanAdaptor{}
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "doubao-seed-tts-2.0"},
		RelayMode:   relayconstant.RelayModeAudioSpeech,
	}

	reader, err := adaptor.ConvertAudioRequest(c, info, dto.AudioRequest{
		Model:          "doubao-seed-tts-2.0",
		Input:          "hello",
		Voice:          "alloy",
		ResponseFormat: "pcm",
	})
	require.NoError(t, err)

	body, err := io.ReadAll(reader)
	require.NoError(t, err)

	var upstream struct {
		ReqParams struct {
			Text        string `json:"text"`
			Speaker     string `json:"speaker"`
			AudioParams struct {
				Format     string `json:"format"`
				SampleRate int    `json:"sample_rate"`
			} `json:"audio_params"`
		} `json:"req_params"`
	}
	require.NoError(t, common.Unmarshal(body, &upstream))
	assert.Equal(t, "hello", upstream.ReqParams.Text)
	assert.Equal(t, "zh_male_M392_conversation_wvae_bigtts", upstream.ReqParams.Speaker)
	assert.Equal(t, "pcm", upstream.ReqParams.AudioParams.Format)
	assert.Equal(t, 24000, upstream.ReqParams.AudioParams.SampleRate)
	assert.Equal(t, "pcm", c.GetString(contextKeyResponseFormat))
}

func TestAgentPlanTTSResponseWritesDecodedAudio(t *testing.T) {
	audio := []byte("audio bytes")
	body := strings.Join([]string{
		`{"code":0,"message":"","data":"` + base64.StdEncoding.EncodeToString(audio) + `"}`,
		`{"code":20000000,"message":"ok","data":null,"usage":{"text_words":2}}`,
	}, "\n")
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeAudioSpeech,
	}
	info.SetEstimatePromptTokens(3)

	usage, apiErr := handleAgentPlanTTSResponse(c, &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
	}, info, "mp3")

	require.Nil(t, apiErr)
	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, "audio/mpeg", recorder.Header().Get("Content-Type"))
	assert.Equal(t, audio, recorder.Body.Bytes())
	require.IsType(t, &dto.Usage{}, usage)
	gotUsage := usage.(*dto.Usage)
	assert.Equal(t, 3, gotUsage.PromptTokens)
	assert.Equal(t, 3, gotUsage.TotalTokens)
}
