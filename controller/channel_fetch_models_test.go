package controller

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFetchModelsVolcEnginePlanUsesStaticModels(t *testing.T) {
	gin.SetMode(gin.TestMode)

	called := false
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		http.NotFound(w, r)
	}))
	defer upstream.Close()

	body, err := common.Marshal(gin.H{
		"base_url": upstream.URL + "/api/plan/v3",
		"type":     constant.ChannelTypeVolcEnginePlan,
		"key":      "agent-plan-key",
	})
	require.NoError(t, err)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/channel/fetch_models", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	FetchModels(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool     `json:"success"`
		Data    []string `json:"data"`
		Message string   `json:"message"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success, response.Message)
	assert.Contains(t, response.Data, "doubao-seed-2.0-pro")
	assert.Contains(t, response.Data, "doubao-seed-tts-2.0")
	assert.False(t, called)
}

func TestFetchVolcEngineAgentPlanModelIDsUsesSignedOpenAPI(t *testing.T) {
	called := false
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true

		assert.Equal(t, http.MethodPost, r.Method)
		assert.Equal(t, "/", r.URL.Path)
		assert.Equal(t, "ListArkAgentPlanModel", r.URL.Query().Get("Action"))
		assert.Equal(t, "2024-01-01", r.URL.Query().Get("Version"))
		assert.Equal(t, "application/json; charset=UTF-8", r.Header.Get("Content-Type"))
		assert.Equal(t, "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a", r.Header.Get("X-Content-Sha256"))
		assert.NotEmpty(t, r.Header.Get("X-Date"))

		auth := r.Header.Get("Authorization")
		assert.True(t, strings.HasPrefix(auth, "HMAC-SHA256 Credential=test-ak/"), auth)
		assert.Contains(t, auth, "/cn-beijing/ark_stg/request")
		assert.Contains(t, auth, "SignedHeaders=host;x-content-sha256;x-date")

		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		assert.JSONEq(t, `{}`, string(body))

		_, err = w.Write([]byte(`{"Result":{"Datas":[{"ModelID":"doubao-seed-2.0-pro"},{"ModelID":"doubao-seed-tts-2.0"}]}}`))
		require.NoError(t, err)
	}))
	defer upstream.Close()

	key, err := common.Marshal(gin.H{
		"api_key":          "agent-plan-key",
		"access_key":       "test-ak",
		"secret_key":       "test-sk",
		"openapi_base_url": upstream.URL,
	})
	require.NoError(t, err)

	models, err := fetchVolcEngineAgentPlanModelIDs(string(key), "")

	require.NoError(t, err)
	assert.True(t, called)
	assert.Equal(t, []string{"doubao-seed-2.0-pro", "doubao-seed-tts-2.0"}, models)
}
