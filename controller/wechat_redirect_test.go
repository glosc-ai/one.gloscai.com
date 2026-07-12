package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIsValidWeChatRedirectURI(t *testing.T) {
	tests := []struct {
		name  string
		value string
		valid bool
	}{
		{name: "empty uses browser origin fallback", value: "", valid: true},
		{name: "https callback", value: "https://login.example.com/oauth/wechat", valid: true},
		{name: "local http callback", value: "http://localhost:3000/oauth/wechat", valid: true},
		{name: "callback with query", value: "https://login.example.com/oauth/wechat?source=web", valid: true},
		{name: "relative callback", value: "/oauth/wechat", valid: false},
		{name: "non http scheme", value: "javascript:alert(1)", valid: false},
		{name: "missing host", value: "https:///oauth/wechat", valid: false},
		{name: "credentials", value: "https://user:password@login.example.com/oauth/wechat", valid: false},
		{name: "fragment", value: "https://login.example.com/oauth/wechat#fragment", valid: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.valid, isValidWeChatRedirectURI(test.value))
		})
	}
}

func TestGetStatusIncludesWeChatRedirectURI(t *testing.T) {
	oldRedirectURI := common.WeChatRedirectURI
	t.Cleanup(func() {
		common.WeChatRedirectURI = oldRedirectURI
	})
	common.WeChatRedirectURI = "https://login.example.com/oauth/wechat"

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/status", nil)

	GetStatus(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Data map[string]any `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.Equal(t, common.WeChatRedirectURI, response.Data["wechat_redirect_uri"])
}
