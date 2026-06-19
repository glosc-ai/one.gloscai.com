package service

import (
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

const maxGeneratedVideoUploadBytes int64 = 512 << 20

var videoURLFieldPriority = []string{
	"url",
	"video_url",
	"result_url",
	"remote_url",
	"output",
	"remixed_from_video_id",
}

func normalizeVideoResultLocation(ctx context.Context, task *model.Task, location string) (string, error) {
	location = strings.TrimSpace(location)
	if location == "" {
		return "", nil
	}
	if isHTTPURL(location) {
		return location, nil
	}
	if strings.HasPrefix(location, "data:") {
		contentType, data, err := decodeVideoDataURL(location)
		if err != nil {
			return "", err
		}
		return uploadGeneratedVideoToR2(ctx, task, contentType, data)
	}
	return "", fmt.Errorf("unsupported video result location")
}

func fetchAndStoreVideoContent(ctx context.Context, task *model.Task, baseURL string, upstreamID string, apiKey string, proxy string) (string, error) {
	if strings.TrimSpace(baseURL) == "" || strings.TrimSpace(upstreamID) == "" {
		return "", nil
	}
	contentURL := fmt.Sprintf("%s/v1/videos/%s/content", strings.TrimRight(baseURL, "/"), url.PathEscape(upstreamID))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, contentURL, nil)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(apiKey) != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}

	client, err := GetHttpClientWithProxy(proxy)
	if err != nil {
		return "", fmt.Errorf("new proxy http client failed: %w", err)
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return "", fmt.Errorf("video content endpoint returned %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	if resp.ContentLength > maxGeneratedVideoUploadBytes {
		return "", fmt.Errorf("video content is too large: %d bytes", resp.ContentLength)
	}

	data, err := io.ReadAll(io.LimitReader(resp.Body, maxGeneratedVideoUploadBytes+1))
	if err != nil {
		return "", err
	}
	if int64(len(data)) > maxGeneratedVideoUploadBytes {
		return "", fmt.Errorf("video content exceeds %d bytes", maxGeneratedVideoUploadBytes)
	}
	if len(data) == 0 {
		return "", fmt.Errorf("video content is empty")
	}

	contentType := strings.TrimSpace(resp.Header.Get("Content-Type"))
	if isJSONPayload(contentType, data) {
		if location := extractVideoLocationFromJSON(data); location != "" {
			return normalizeVideoResultLocation(ctx, task, location)
		}
		return "", fmt.Errorf("video content JSON did not contain a video URL")
	}
	if isTextPayload(contentType) {
		text := strings.TrimSpace(string(data))
		if looksLikeVideoLocation(text) {
			return normalizeVideoResultLocation(ctx, task, text)
		}
	}

	contentType = normalizeVideoContentType(contentType, data)
	return uploadGeneratedVideoToR2(ctx, task, contentType, data)
}

func uploadGeneratedVideoToR2(ctx context.Context, task *model.Task, contentType string, data []byte) (string, error) {
	if !R2StorageEnabled() {
		return "", fmt.Errorf("R2 storage is not enabled")
	}
	contentType = normalizeVideoContentType(contentType, data)
	objectKey := BuildMediaObjectKey(task.UserId, task.TaskID+videoExtensionForContentType(contentType))
	return UploadToR2(ctx, objectKey, contentType, data)
}

func decodeVideoDataURL(dataURL string) (string, []byte, error) {
	parts := strings.SplitN(dataURL, ",", 2)
	if len(parts) != 2 {
		return "", nil, fmt.Errorf("invalid data url")
	}

	header := parts[0]
	payload := parts[1]
	if !strings.HasPrefix(header, "data:") || !strings.Contains(header, ";base64") {
		return "", nil, fmt.Errorf("unsupported data url")
	}

	contentType := strings.TrimPrefix(header, "data:")
	contentType = strings.TrimSuffix(contentType, ";base64")
	if contentType == "" {
		contentType = "video/mp4"
	}

	videoBytes, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		videoBytes, err = base64.RawStdEncoding.DecodeString(payload)
		if err != nil {
			return "", nil, err
		}
	}
	return contentType, videoBytes, nil
}

func normalizeVideoContentType(contentType string, data []byte) string {
	mediaType, _, err := mime.ParseMediaType(strings.TrimSpace(contentType))
	if err == nil && strings.HasPrefix(mediaType, "video/") {
		return mediaType
	}
	detected := http.DetectContentType(data)
	if strings.HasPrefix(detected, "video/") {
		return detected
	}
	return "video/mp4"
}

func videoExtensionForContentType(contentType string) string {
	mediaType, _, err := mime.ParseMediaType(strings.TrimSpace(contentType))
	if err != nil {
		return ".mp4"
	}
	switch mediaType {
	case "video/mp4", "application/mp4":
		return ".mp4"
	case "video/webm":
		return ".webm"
	case "video/quicktime":
		return ".mov"
	case "video/x-msvideo":
		return ".avi"
	default:
		return ".mp4"
	}
}

func isHTTPURL(value string) bool {
	u, err := url.Parse(strings.TrimSpace(value))
	return err == nil && (u.Scheme == "http" || u.Scheme == "https") && u.Host != ""
}

func looksLikeVideoLocation(value string) bool {
	value = strings.TrimSpace(value)
	return isHTTPURL(value) || strings.HasPrefix(value, "data:")
}

func isJSONPayload(contentType string, data []byte) bool {
	mediaType, _, _ := mime.ParseMediaType(strings.TrimSpace(contentType))
	if strings.Contains(mediaType, "json") {
		return true
	}
	trimmed := strings.TrimSpace(string(data[:min(len(data), 64)]))
	return strings.HasPrefix(trimmed, "{") || strings.HasPrefix(trimmed, "[")
}

func isTextPayload(contentType string) bool {
	mediaType, _, _ := mime.ParseMediaType(strings.TrimSpace(contentType))
	return strings.HasPrefix(mediaType, "text/")
}

func extractVideoLocationFromJSON(data []byte) string {
	var payload any
	if err := common.Unmarshal(data, &payload); err != nil {
		return ""
	}
	return extractVideoLocation(payload)
}

func extractVideoLocation(value any) string {
	switch typed := value.(type) {
	case map[string]any:
		for _, key := range videoURLFieldPriority {
			if raw, ok := typed[key]; ok {
				if s, ok := raw.(string); ok && looksLikeVideoLocation(s) {
					return strings.TrimSpace(s)
				}
			}
		}
		for _, raw := range typed {
			if location := extractVideoLocation(raw); location != "" {
				return location
			}
		}
	case []any:
		for _, raw := range typed {
			if location := extractVideoLocation(raw); location != "" {
				return location
			}
		}
	case string:
		if looksLikeVideoLocation(typed) {
			return strings.TrimSpace(typed)
		}
	}
	return ""
}
