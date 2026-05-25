package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	githubCopilotTokenURL       = "https://api.github.com/copilot_internal/v2/token"
	githubCopilotDeviceCodeURL  = "https://github.com/login/device/code"
	githubCopilotAccessTokenURL = "https://github.com/login/oauth/access_token"
	githubCopilotDefaultBaseURL = "https://api.individual.githubcopilot.com"
	githubCopilotLegacyBaseURL  = "https://api.githubcopilot.com"
	githubCopilotHTTPTimeout    = 20 * time.Second
	githubCopilotOAuthClientID  = "Iv1.b507a08c87ecfe98"
	githubCopilotOAuthScope     = "read:user"

	githubCopilotDeviceAuthorizationPending = "authorization_pending"
	githubCopilotDeviceSlowDown             = "slow_down"
	githubCopilotDeviceExpiredToken         = "expired_token"
	githubCopilotDeviceAccessDenied         = "access_denied"

	githubCopilotEditorVersion       = "vscode/1.107.0"
	githubCopilotEditorPluginVersion = "copilot-chat/0.35.0"
	githubCopilotUserAgent           = "GitHubCopilotChat/0.35.0"
	githubCopilotGitHubAPIVersion    = "2025-04-01"
	githubCopilotIntegrationID       = "vscode-chat"
)

var (
	ErrGitHubCopilotDeviceAuthorizationPending = errors.New("github copilot device authorization pending")
	ErrGitHubCopilotDeviceAccessDenied         = errors.New("github copilot device authorization denied")
	ErrGitHubCopilotDeviceExpired              = errors.New("github copilot device code expired")
)

type GitHubCopilotTokenResult struct {
	Token     string
	ExpiresAt time.Time
	RefreshAt time.Time
	BaseURL   string
}

type GitHubCopilotDeviceCodeResult struct {
	DeviceCode      string
	UserCode        string
	VerificationURL string
	ExpiresIn       int
	Interval        int
}

type githubCopilotCredential struct {
	GitHubToken  string `json:"github_token,omitempty"`
	AccessToken  string `json:"access_token,omitempty"`
	Token        string `json:"token,omitempty"`
	CopilotToken string `json:"copilot_token,omitempty"`
}

type githubCopilotTokenCacheEntry struct {
	token     string
	expiresAt time.Time
	refreshAt time.Time
	baseURL   string
}

var githubCopilotTokenCache sync.Map

func CreateGitHubCopilotDeviceCode(ctx context.Context, proxyURL string) (*GitHubCopilotDeviceCodeResult, error) {
	client, err := getGitHubCopilotHTTPClient(proxyURL)
	if err != nil {
		return nil, err
	}
	return requestGitHubCopilotDeviceCode(ctx, client, githubCopilotDeviceCodeURL)
}

func WaitGitHubCopilotDeviceAccessToken(ctx context.Context, deviceCode string, intervalSeconds int, proxyURL string) (string, error) {
	client, err := getGitHubCopilotHTTPClient(proxyURL)
	if err != nil {
		return "", err
	}
	interval := time.Duration(intervalSeconds) * time.Second
	if interval < time.Second {
		interval = time.Second
	}

	for {
		accessToken, status, err := pollGitHubCopilotDeviceAccessToken(ctx, client, githubCopilotAccessTokenURL, deviceCode)
		if err != nil {
			return "", err
		}
		if accessToken != "" {
			return accessToken, nil
		}

		switch status {
		case githubCopilotDeviceAuthorizationPending:
		case githubCopilotDeviceSlowDown:
			interval += 2 * time.Second
		case githubCopilotDeviceExpiredToken:
			return "", ErrGitHubCopilotDeviceExpired
		case githubCopilotDeviceAccessDenied:
			return "", ErrGitHubCopilotDeviceAccessDenied
		default:
			return "", fmt.Errorf("github copilot device flow error: %s", status)
		}

		timer := time.NewTimer(interval)
		select {
		case <-ctx.Done():
			timer.Stop()
			return "", fmt.Errorf("%w: %w", ErrGitHubCopilotDeviceAuthorizationPending, ctx.Err())
		case <-timer.C:
		}
	}
}

func ResolveGitHubCopilotAccessToken(ctx context.Context, rawKey string, proxyURL string) (string, error) {
	result, err := ResolveGitHubCopilotToken(ctx, rawKey, proxyURL)
	if err != nil {
		return "", err
	}
	return result.Token, nil
}

func ResolveGitHubCopilotToken(ctx context.Context, rawKey string, proxyURL string) (*GitHubCopilotTokenResult, error) {
	githubToken, directToken, err := parseGitHubCopilotCredential(strings.TrimSpace(rawKey))
	if err != nil {
		return nil, err
	}
	if directToken != "" {
		return newGitHubCopilotTokenResult(directToken, time.Time{}, time.Time{}), nil
	}
	if githubToken == "" {
		return nil, errors.New("github copilot channel: github_token is required")
	}

	now := time.Now()
	cacheKey := getGitHubCopilotTokenCacheKey(githubToken, proxyURL)
	if cached, ok := githubCopilotTokenCache.Load(cacheKey); ok {
		entry, ok := cached.(githubCopilotTokenCacheEntry)
		if ok && entry.token != "" && now.Before(entry.refreshAt) && now.Before(entry.expiresAt) {
			return &GitHubCopilotTokenResult{
				Token:     entry.token,
				ExpiresAt: entry.expiresAt,
				RefreshAt: entry.refreshAt,
				BaseURL:   normalizeGitHubCopilotBaseURL(entry.baseURL, githubCopilotDefaultBaseURL),
			}, nil
		}
	}

	client, err := getGitHubCopilotHTTPClient(proxyURL)
	if err != nil {
		return nil, err
	}
	result, err := fetchGitHubCopilotAccessToken(ctx, client, githubCopilotTokenURL, githubToken)
	if err != nil {
		return nil, err
	}

	githubCopilotTokenCache.Store(cacheKey, githubCopilotTokenCacheEntry{
		token:     result.Token,
		expiresAt: result.ExpiresAt,
		refreshAt: result.RefreshAt,
		baseURL:   result.BaseURL,
	})
	return result, nil
}

func FetchGitHubCopilotModels(ctx context.Context, baseURL string, rawKey string, proxyURL string) ([]string, error) {
	tokenResult, err := ResolveGitHubCopilotToken(ctx, rawKey, proxyURL)
	if err != nil {
		return nil, err
	}

	client, err := getGitHubCopilotHTTPClient(proxyURL)
	if err != nil {
		return nil, err
	}

	modelsURL := ResolveGitHubCopilotBaseURL(baseURL, tokenResult.BaseURL) + "/models"

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, modelsURL, nil)
	if err != nil {
		return nil, err
	}
	setGitHubCopilotModelHeaders(&req.Header, tokenResult.Token)

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("github copilot models fetch failed: status=%d", resp.StatusCode)
	}

	var payload struct {
		Data []struct {
			ID           string `json:"id"`
			Object       string `json:"object"`
			Capabilities struct {
				Type string `json:"type"`
			} `json:"capabilities"`
		} `json:"data"`
	}
	if err := common.DecodeJson(resp.Body, &payload); err != nil {
		return nil, err
	}

	models := make([]string, 0, len(payload.Data))
	seen := make(map[string]struct{}, len(payload.Data))
	for _, item := range payload.Data {
		id := strings.TrimSpace(item.ID)
		if id == "" {
			continue
		}
		if item.Object != "" && !strings.EqualFold(item.Object, "model") {
			continue
		}
		if item.Capabilities.Type != "" && !strings.EqualFold(item.Capabilities.Type, "chat") {
			continue
		}
		if strings.HasPrefix(id, "accounts/") {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		models = append(models, id)
	}
	return models, nil
}

func parseGitHubCopilotCredential(raw string) (githubToken string, directToken string, err error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", "", errors.New("github copilot channel: empty key")
	}

	if strings.HasPrefix(raw, "{") {
		var credential githubCopilotCredential
		if err := common.Unmarshal([]byte(raw), &credential); err != nil {
			return "", "", errors.New("github copilot channel: invalid key json")
		}

		githubToken = strings.TrimSpace(credential.GitHubToken)
		candidateToken := strings.TrimSpace(firstNonEmpty(credential.CopilotToken, credential.Token, credential.AccessToken))
		if githubToken == "" && looksLikeGitHubToken(candidateToken) {
			githubToken = candidateToken
			candidateToken = ""
		}
		return githubToken, candidateToken, nil
	}

	if looksLikeGitHubCopilotBearerToken(raw) {
		return "", raw, nil
	}
	return raw, "", nil
}

func fetchGitHubCopilotAccessToken(ctx context.Context, client *http.Client, tokenURL string, githubToken string) (*GitHubCopilotTokenResult, error) {
	githubToken = strings.TrimSpace(githubToken)
	if githubToken == "" {
		return nil, errors.New("empty github token")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, tokenURL, nil)
	if err != nil {
		return nil, err
	}
	setGitHubCopilotTokenExchangeHeaders(&req.Header, githubToken)

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("github copilot token fetch failed: status=%d", resp.StatusCode)
	}

	var payload struct {
		Token     string `json:"token"`
		ExpiresAt any    `json:"expires_at"`
		RefreshIn int64  `json:"refresh_in"`
	}
	if err := common.DecodeJson(resp.Body, &payload); err != nil {
		return nil, err
	}

	token := strings.TrimSpace(payload.Token)
	if token == "" {
		return nil, errors.New("github copilot token response missing token")
	}

	now := time.Now()
	expiresAt, err := parseGitHubCopilotExpiresAt(payload.ExpiresAt)
	if err != nil {
		return nil, err
	}

	refreshAt := now.Add(time.Duration(payload.RefreshIn) * time.Second)
	if payload.RefreshIn <= 0 || !refreshAt.After(now) || !refreshAt.Before(expiresAt) {
		refreshAt = expiresAt.Add(-5 * time.Minute)
	}
	if !refreshAt.After(now) {
		refreshAt = now.Add(time.Minute)
	}

	return newGitHubCopilotTokenResult(token, expiresAt, refreshAt), nil
}

func requestGitHubCopilotDeviceCode(ctx context.Context, client *http.Client, deviceCodeURL string) (*GitHubCopilotDeviceCodeResult, error) {
	form := url.Values{}
	form.Set("client_id", githubCopilotOAuthClientID)
	form.Set("scope", githubCopilotOAuthScope)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, deviceCodeURL, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	setGitHubCopilotDeviceFlowHeaders(&req.Header)

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("github copilot device code failed: status=%d", resp.StatusCode)
	}

	var payload struct {
		DeviceCode      string `json:"device_code"`
		UserCode        string `json:"user_code"`
		VerificationURL string `json:"verification_uri"`
		ExpiresIn       int    `json:"expires_in"`
		Interval        int    `json:"interval"`
	}
	if err := common.DecodeJson(resp.Body, &payload); err != nil {
		return nil, err
	}

	deviceCode := strings.TrimSpace(payload.DeviceCode)
	userCode := strings.TrimSpace(payload.UserCode)
	verificationURL, err := normalizeGitHubCopilotDeviceVerificationURL(payload.VerificationURL)
	if err != nil {
		return nil, err
	}
	if deviceCode == "" || userCode == "" || payload.ExpiresIn <= 0 {
		return nil, errors.New("github copilot device code response missing fields")
	}
	interval := payload.Interval
	if interval <= 0 {
		interval = 5
	}

	return &GitHubCopilotDeviceCodeResult{
		DeviceCode:      deviceCode,
		UserCode:        userCode,
		VerificationURL: verificationURL,
		ExpiresIn:       payload.ExpiresIn,
		Interval:        interval,
	}, nil
}

func pollGitHubCopilotDeviceAccessToken(ctx context.Context, client *http.Client, accessTokenURL string, deviceCode string) (accessToken string, status string, err error) {
	deviceCode = strings.TrimSpace(deviceCode)
	if deviceCode == "" {
		return "", "", errors.New("empty device_code")
	}

	form := url.Values{}
	form.Set("client_id", githubCopilotOAuthClientID)
	form.Set("device_code", deviceCode)
	form.Set("grant_type", "urn:ietf:params:oauth:grant-type:device_code")

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, accessTokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", "", err
	}
	setGitHubCopilotDeviceFlowHeaders(&req.Header)

	resp, err := client.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	var payload struct {
		AccessToken      string `json:"access_token"`
		TokenType        string `json:"token_type"`
		Scope            string `json:"scope"`
		Error            string `json:"error"`
		ErrorDescription string `json:"error_description"`
	}
	if err := common.DecodeJson(resp.Body, &payload); err != nil {
		return "", "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", "", fmt.Errorf("github copilot device token failed: status=%d", resp.StatusCode)
	}

	if token := strings.TrimSpace(payload.AccessToken); token != "" {
		return token, "", nil
	}
	if code := strings.TrimSpace(payload.Error); code != "" {
		return "", code, nil
	}
	return "", "", errors.New("github copilot device token response missing fields")
}

func getGitHubCopilotHTTPClient(proxyURL string) (*http.Client, error) {
	baseClient, err := GetHttpClientWithProxy(strings.TrimSpace(proxyURL))
	if err != nil {
		return nil, err
	}
	if baseClient == nil {
		return &http.Client{Timeout: githubCopilotHTTPTimeout}, nil
	}
	clientCopy := *baseClient
	if clientCopy.Timeout == 0 {
		clientCopy.Timeout = githubCopilotHTTPTimeout
	}
	return &clientCopy, nil
}

func ResolveGitHubCopilotBaseURL(configuredBaseURL string, tokenBaseURL string) string {
	configured := normalizeGitHubCopilotBaseURL(configuredBaseURL, "")
	if configured != "" && !isGitHubCopilotDefaultBaseURL(configured) {
		return configured
	}
	return normalizeGitHubCopilotBaseURL(tokenBaseURL, githubCopilotDefaultBaseURL)
}

func SetGitHubCopilotAPIHeaders(header *http.Header, accessToken string, isStream bool) {
	header.Set("Authorization", "Bearer "+accessToken)
	header.Set("Content-Type", "application/json")
	if isStream {
		header.Set("Accept", "text/event-stream")
	} else {
		header.Set("Accept", "application/json")
	}
	setGitHubCopilotIDEHeaders(header, false)
	header.Set("Copilot-Integration-Id", githubCopilotIntegrationID)
	header.Set("Openai-Organization", "github-copilot")
}

func setGitHubCopilotTokenExchangeHeaders(header *http.Header, githubToken string) {
	header.Set("Accept", "application/json")
	header.Set("Authorization", "Bearer "+githubToken)
	header.Set("Copilot-Integration-Id", githubCopilotIntegrationID)
	setGitHubCopilotIDEHeaders(header, true)
}

func setGitHubCopilotModelHeaders(header *http.Header, accessToken string) {
	header.Set("Accept", "application/json")
	header.Set("Authorization", "Bearer "+accessToken)
	header.Set("Copilot-Integration-Id", githubCopilotIntegrationID)
	setGitHubCopilotIDEHeaders(header, false)
}

func setGitHubCopilotIDEHeaders(header *http.Header, includeAPIVersion bool) {
	header.Set("Accept-Encoding", "identity")
	header.Set("Editor-Version", githubCopilotEditorVersion)
	header.Set("Editor-Plugin-Version", githubCopilotEditorPluginVersion)
	header.Set("User-Agent", githubCopilotUserAgent)
	if includeAPIVersion {
		header.Set("X-Github-Api-Version", githubCopilotGitHubAPIVersion)
	}
}

func setGitHubCopilotDeviceFlowHeaders(header *http.Header) {
	header.Set("Accept", "application/json")
	header.Set("Content-Type", "application/x-www-form-urlencoded")
}

func normalizeGitHubCopilotDeviceVerificationURL(raw string) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return "", errors.New("github copilot device flow returned an invalid verification URL")
	}
	if parsed.Scheme != "https" || !strings.EqualFold(parsed.Hostname(), "github.com") || parsed.EscapedPath() != "/login/device" || parsed.User != nil {
		return "", errors.New("github copilot device flow returned an unexpected verification URL")
	}
	return "https://github.com/login/device", nil
}

func getGitHubCopilotTokenCacheKey(githubToken string, proxyURL string) string {
	sum := sha256.Sum256([]byte(githubToken + "\x00" + proxyURL))
	return hex.EncodeToString(sum[:])
}

func looksLikeGitHubToken(token string) bool {
	token = strings.TrimSpace(token)
	if token == "" {
		return false
	}
	for _, prefix := range []string{"gho_", "ghp_", "ghu_", "ghs_", "ghr_", "github_pat_"} {
		if strings.HasPrefix(token, prefix) {
			return true
		}
	}
	return false
}

func looksLikeGitHubCopilotBearerToken(token string) bool {
	token = strings.TrimSpace(token)
	return strings.HasPrefix(token, "tid=") || (strings.Contains(token, ";") && strings.Contains(token, "exp="))
}

func newGitHubCopilotTokenResult(token string, expiresAt time.Time, refreshAt time.Time) *GitHubCopilotTokenResult {
	now := time.Now()
	if expiresAt.IsZero() {
		expiresAt = parseGitHubCopilotTokenExpiresAt(token)
	}
	if expiresAt.IsZero() || !expiresAt.After(now) {
		expiresAt = now.Add(25 * time.Minute)
	}
	if refreshAt.IsZero() || !refreshAt.After(now) || !refreshAt.Before(expiresAt) {
		refreshAt = expiresAt.Add(-5 * time.Minute)
	}
	if !refreshAt.After(now) {
		refreshAt = now.Add(time.Minute)
	}
	baseURL := DeriveGitHubCopilotAPIBaseURLFromToken(token)
	if baseURL == "" {
		baseURL = githubCopilotDefaultBaseURL
	}
	return &GitHubCopilotTokenResult{
		Token:     token,
		ExpiresAt: expiresAt,
		RefreshAt: refreshAt,
		BaseURL:   baseURL,
	}
}

func parseGitHubCopilotExpiresAt(raw any) (time.Time, error) {
	var epoch float64
	switch value := raw.(type) {
	case float64:
		epoch = value
	case int:
		epoch = float64(value)
	case int64:
		epoch = float64(value)
	case string:
		parsed, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
		if err != nil {
			return time.Time{}, errors.New("github copilot token response has invalid expires_at")
		}
		epoch = parsed
	default:
		return time.Time{}, errors.New("github copilot token response missing expires_at")
	}
	if epoch <= 0 || math.IsNaN(epoch) || math.IsInf(epoch, 0) {
		return time.Time{}, errors.New("github copilot token response has invalid expires_at")
	}
	if epoch < 100_000_000_000 {
		return time.Unix(int64(epoch), 0), nil
	}
	return time.UnixMilli(int64(epoch)), nil
}

func parseGitHubCopilotTokenExpiresAt(token string) time.Time {
	for _, part := range strings.Split(token, ";") {
		key, value, ok := strings.Cut(strings.TrimSpace(part), "=")
		if !ok || !strings.EqualFold(strings.TrimSpace(key), "exp") {
			continue
		}
		expiresAt, err := parseGitHubCopilotExpiresAt(strings.TrimSpace(value))
		if err == nil {
			return expiresAt
		}
	}
	return time.Time{}
}

func DeriveGitHubCopilotAPIBaseURLFromToken(token string) string {
	for _, part := range strings.Split(token, ";") {
		key, value, ok := strings.Cut(strings.TrimSpace(part), "=")
		if !ok || !strings.EqualFold(strings.TrimSpace(key), "proxy-ep") {
			continue
		}
		proxyEndpoint := strings.TrimSpace(value)
		if proxyEndpoint == "" {
			return ""
		}
		if !strings.HasPrefix(strings.ToLower(proxyEndpoint), "http://") && !strings.HasPrefix(strings.ToLower(proxyEndpoint), "https://") {
			proxyEndpoint = "https://" + proxyEndpoint
		}
		parsed, err := url.Parse(proxyEndpoint)
		if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
			return ""
		}
		host := strings.ToLower(strings.TrimSpace(parsed.Hostname()))
		if host == "" {
			return ""
		}
		if strings.HasPrefix(host, "proxy.") {
			host = "api." + strings.TrimPrefix(host, "proxy.")
		}
		return "https://" + host
	}
	return ""
}

func normalizeGitHubCopilotBaseURL(baseURL string, fallback string) string {
	trimmed := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if trimmed == "" {
		return strings.TrimRight(strings.TrimSpace(fallback), "/")
	}
	return trimmed
}

func isGitHubCopilotDefaultBaseURL(baseURL string) bool {
	normalized := strings.ToLower(normalizeGitHubCopilotBaseURL(baseURL, ""))
	return normalized == githubCopilotDefaultBaseURL || normalized == githubCopilotLegacyBaseURL
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
