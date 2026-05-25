package service

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
	"time"
)

func TestParseGitHubCopilotCredential(t *testing.T) {
	tests := []struct {
		name            string
		raw             string
		wantGitHubToken string
		wantDirectToken string
		wantErr         bool
	}{
		{
			name:            "raw github token",
			raw:             " ghp_example ",
			wantGitHubToken: "ghp_example",
		},
		{
			name:            "json github token",
			raw:             `{"github_token":"github_pat_example"}`,
			wantGitHubToken: "github_pat_example",
		},
		{
			name:            "json access token that is a github token",
			raw:             `{"access_token":"gho_example"}`,
			wantGitHubToken: "gho_example",
		},
		{
			name:            "direct copilot bearer token",
			raw:             "tid=example; exp=1234567890",
			wantDirectToken: "tid=example; exp=1234567890",
		},
		{
			name:            "json copilot bearer token",
			raw:             `{"copilot_token":"tid=example; exp=1234567890"}`,
			wantDirectToken: "tid=example; exp=1234567890",
		},
		{
			name:    "invalid json",
			raw:     `{`,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotGitHubToken, gotDirectToken, err := parseGitHubCopilotCredential(tt.raw)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if gotGitHubToken != tt.wantGitHubToken {
				t.Fatalf("github token = %q, want %q", gotGitHubToken, tt.wantGitHubToken)
			}
			if gotDirectToken != tt.wantDirectToken {
				t.Fatalf("direct token = %q, want %q", gotDirectToken, tt.wantDirectToken)
			}
		})
	}
}

func TestFetchGitHubCopilotAccessToken(t *testing.T) {
	expiresAt := time.Now().Add(10 * time.Minute).Unix()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer ghp_example" {
			t.Errorf("Authorization = %q", r.Header.Get("Authorization"))
		}
		if r.Header.Get("Copilot-Integration-Id") != githubCopilotIntegrationID {
			t.Errorf("Copilot-Integration-Id = %q", r.Header.Get("Copilot-Integration-Id"))
		}
		if r.Header.Get("Accept-Encoding") != "identity" {
			t.Errorf("Accept-Encoding = %q", r.Header.Get("Accept-Encoding"))
		}
		if r.Header.Get("X-Github-Api-Version") == "" {
			t.Error("missing X-GitHub-Api-Version header")
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"token":"tid=example; proxy-ep=https://proxy.contoso.test; exp=1234567890","expires_at":%d,"refresh_in":120}`, expiresAt)
	}))
	defer server.Close()

	result, err := fetchGitHubCopilotAccessToken(context.Background(), server.Client(), server.URL, "ghp_example")
	if err != nil {
		t.Fatalf("fetch token: %v", err)
	}
	if result.Token != "tid=example; proxy-ep=https://proxy.contoso.test; exp=1234567890" {
		t.Fatalf("token = %q", result.Token)
	}
	if result.BaseURL != "https://api.contoso.test" {
		t.Fatalf("baseURL = %q", result.BaseURL)
	}
	if !result.ExpiresAt.After(time.Now()) {
		t.Fatalf("expiresAt should be in the future, got %s", result.ExpiresAt)
	}
	if !result.RefreshAt.After(time.Now()) || !result.RefreshAt.Before(result.ExpiresAt) {
		t.Fatalf("refreshAt = %s, expiresAt = %s", result.RefreshAt, result.ExpiresAt)
	}
}

func TestRequestGitHubCopilotDeviceCode(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %q", r.Method)
		}
		if r.Header.Get("Accept") != "application/json" {
			t.Errorf("Accept = %q", r.Header.Get("Accept"))
		}
		if err := r.ParseForm(); err != nil {
			t.Errorf("ParseForm: %v", err)
		}
		if r.Form.Get("client_id") != githubCopilotOAuthClientID {
			t.Errorf("client_id = %q", r.Form.Get("client_id"))
		}
		if r.Form.Get("scope") != githubCopilotOAuthScope {
			t.Errorf("scope = %q", r.Form.Get("scope"))
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"device_code":"device-123","user_code":"ABCD-1234","verification_uri":"https://github.com/login/device?user_code=ignored","expires_in":900,"interval":5}`))
	}))
	defer server.Close()

	result, err := requestGitHubCopilotDeviceCode(context.Background(), server.Client(), server.URL)
	if err != nil {
		t.Fatalf("request device code: %v", err)
	}
	if result.DeviceCode != "device-123" {
		t.Fatalf("deviceCode = %q", result.DeviceCode)
	}
	if result.UserCode != "ABCD-1234" {
		t.Fatalf("userCode = %q", result.UserCode)
	}
	if result.VerificationURL != "https://github.com/login/device" {
		t.Fatalf("verificationURL = %q", result.VerificationURL)
	}
	if result.ExpiresIn != 900 || result.Interval != 5 {
		t.Fatalf("expiresIn = %d, interval = %d", result.ExpiresIn, result.Interval)
	}
}

func TestPollGitHubCopilotDeviceAccessToken(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			t.Errorf("ParseForm: %v", err)
		}
		if r.Form.Get("client_id") != githubCopilotOAuthClientID {
			t.Errorf("client_id = %q", r.Form.Get("client_id"))
		}
		if r.Form.Get("device_code") != "device-123" {
			t.Errorf("device_code = %q", r.Form.Get("device_code"))
		}
		if r.Form.Get("grant_type") != "urn:ietf:params:oauth:grant-type:device_code" {
			t.Errorf("grant_type = %q", r.Form.Get("grant_type"))
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"access_token":"gho_authorized","token_type":"bearer","scope":"read:user"}`))
	}))
	defer server.Close()

	token, status, err := pollGitHubCopilotDeviceAccessToken(context.Background(), server.Client(), server.URL, "device-123")
	if err != nil {
		t.Fatalf("poll device token: %v", err)
	}
	if token != "gho_authorized" {
		t.Fatalf("token = %q", token)
	}
	if status != "" {
		t.Fatalf("status = %q", status)
	}
}

func TestPollGitHubCopilotDeviceAccessTokenPending(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"error":"authorization_pending"}`))
	}))
	defer server.Close()

	token, status, err := pollGitHubCopilotDeviceAccessToken(context.Background(), server.Client(), server.URL, "device-123")
	if err != nil {
		t.Fatalf("poll device token: %v", err)
	}
	if token != "" {
		t.Fatalf("token = %q", token)
	}
	if status != githubCopilotDeviceAuthorizationPending {
		t.Fatalf("status = %q", status)
	}
}

func TestFetchGitHubCopilotModelsWithDirectToken(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/models" {
			t.Errorf("path = %q", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer tid=example; exp=1234567890" {
			t.Errorf("Authorization = %q", r.Header.Get("Authorization"))
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[{"id":"gpt-4o","object":"model","capabilities":{"type":"chat"}},{"id":"gpt-4o","object":"model","capabilities":{"type":"chat"}},{"id":"claude-sonnet-4.6","object":"model","capabilities":{"type":"chat"}},{"id":"accounts/msft/routers/abc123","object":"model","capabilities":{"type":"chat"}},{"id":"text-embedding-3-small","object":"model","capabilities":{"type":"embedding"}},{"id":"not-a-model","object":"router","capabilities":{"type":"chat"}},{"id":""}]}`))
	}))
	defer server.Close()

	models, err := FetchGitHubCopilotModels(context.Background(), server.URL, "tid=example; exp=1234567890", "")
	if err != nil {
		t.Fatalf("fetch models: %v", err)
	}
	want := []string{"gpt-4o", "claude-sonnet-4.6"}
	if !reflect.DeepEqual(models, want) {
		t.Fatalf("models = %#v, want %#v", models, want)
	}
}

func TestDeriveGitHubCopilotAPIBaseURLFromToken(t *testing.T) {
	tests := []struct {
		name  string
		token string
		want  string
	}{
		{
			name:  "individual proxy endpoint",
			token: "tid=example;proxy-ep=https://proxy.individual.githubcopilot.com;",
			want:  "https://api.individual.githubcopilot.com",
		},
		{
			name:  "bare proxy endpoint",
			token: "tid=example;proxy-ep=proxy.example.com;",
			want:  "https://api.example.com",
		},
		{
			name:  "non proxy endpoint",
			token: "tid=example;proxy-ep=https://api.githubcopilot.com;",
			want:  "https://api.githubcopilot.com",
		},
		{
			name:  "invalid endpoint",
			token: "tid=example;proxy-ep=javascript:alert(1);",
			want:  "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := DeriveGitHubCopilotAPIBaseURLFromToken(tt.token); got != tt.want {
				t.Fatalf("baseURL = %q, want %q", got, tt.want)
			}
		})
	}
}
