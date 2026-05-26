package oauth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestWeChatProviderUsesUnionIDFromUserInfo(t *testing.T) {
	oldAppId := common.WeChatAppId
	oldAppSecret := common.WeChatAppSecret
	t.Cleanup(func() {
		common.WeChatAppId = oldAppId
		common.WeChatAppSecret = oldAppSecret
	})
	common.WeChatAppId = "wx-test-app"
	common.WeChatAppSecret = "test-secret"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/token":
			if got := r.URL.Query().Get("appid"); got != common.WeChatAppId {
				t.Fatalf("appid = %q, want %q", got, common.WeChatAppId)
			}
			if got := r.URL.Query().Get("secret"); got != common.WeChatAppSecret {
				t.Fatalf("secret = %q, want %q", got, common.WeChatAppSecret)
			}
			if got := r.URL.Query().Get("code"); got != "auth-code" {
				t.Fatalf("code = %q, want auth-code", got)
			}
			_, _ = w.Write([]byte(`{"access_token":"access-token","expires_in":7200,"refresh_token":"refresh-token","openid":"openid-from-token","scope":"snsapi_login","unionid":"union-from-token"}`))
		case "/userinfo":
			if got := r.URL.Query().Get("access_token"); got != "access-token" {
				t.Fatalf("access_token = %q, want access-token", got)
			}
			if got := r.URL.Query().Get("openid"); got != "openid-from-token" {
				t.Fatalf("openid = %q, want openid-from-token", got)
			}
			_, _ = w.Write([]byte(`{"openid":"openid-from-userinfo","nickname":"Tester","unionid":"union-from-userinfo"}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()
	t.Setenv("WECHAT_OAUTH_TOKEN_ENDPOINT", server.URL+"/token")
	t.Setenv("WECHAT_USERINFO_ENDPOINT", server.URL+"/userinfo")

	provider := &WeChatProvider{}
	token, err := provider.ExchangeToken(context.Background(), "auth-code", nil)
	if err != nil {
		t.Fatalf("ExchangeToken() error = %v", err)
	}

	user, err := provider.GetUserInfo(context.Background(), token)
	if err != nil {
		t.Fatalf("GetUserInfo() error = %v", err)
	}
	if user.ProviderUserID != "union-from-userinfo" {
		t.Fatalf("ProviderUserID = %q, want union-from-userinfo", user.ProviderUserID)
	}
	if user.DisplayName != "Tester" {
		t.Fatalf("DisplayName = %q, want Tester", user.DisplayName)
	}
}

func TestWeChatProviderFallsBackToOpenID(t *testing.T) {
	t.Setenv("WECHAT_USERINFO_ENDPOINT", "://bad-url")

	provider := &WeChatProvider{}
	user, err := provider.GetUserInfo(context.Background(), &OAuthToken{
		AccessToken: "access-token",
		Extra: map[string]any{
			"openid": "openid-only",
		},
	})
	if err != nil {
		t.Fatalf("GetUserInfo() error = %v", err)
	}
	if user.ProviderUserID != "openid-only" {
		t.Fatalf("ProviderUserID = %q, want openid-only", user.ProviderUserID)
	}
}
