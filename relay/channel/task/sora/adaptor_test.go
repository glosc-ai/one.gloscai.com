package sora

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestParseTaskResultExtractsAgnesVideoURL(t *testing.T) {
	adaptor := &TaskAdaptor{}
	taskInfo, err := adaptor.ParseTaskResult([]byte(`{
		"id": "task_123",
		"video_id": "video_123",
		"model": "agnes-video-v2.0",
		"status": "completed",
		"progress": 100,
		"remixed_from_video_id": "https://storage.example.com/result.mp4"
	}`))

	require.NoError(t, err)
	require.Equal(t, model.TaskStatusSuccess, taskInfo.Status)
	require.Equal(t, "https://storage.example.com/result.mp4", taskInfo.Url)
}

func TestFetchTaskUsesAgnesVideoIDEndpoint(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/agnesapi", r.URL.Path)
		require.Equal(t, "video_123", r.URL.Query().Get("video_id"))
		require.Equal(t, "agnes-video-v2.0", r.URL.Query().Get("model_name"))
		_, _ = w.Write([]byte(`{"status":"completed"}`))
	}))
	defer server.Close()

	adaptor := &TaskAdaptor{}
	resp, err := adaptor.FetchTask(server.URL, "test-key", map[string]any{
		"task_id":  "task_123",
		"video_id": "video_123",
		"model":    "agnes-video-v2.0",
	}, "")
	require.NoError(t, err)
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.JSONEq(t, `{"status":"completed"}`, string(body))
}

func TestConvertToOpenAIVideoAddsPlayableMetadataURL(t *testing.T) {
	adaptor := &TaskAdaptor{}
	task := &model.Task{
		TaskID: "task_public",
		Data:   []byte(`{"id":"upstream_task","status":"completed","metadata":{}}`),
		PrivateData: model.TaskPrivateData{
			ResultURL: "https://cdn.example.com/result.mp4",
		},
	}

	data, err := adaptor.ConvertToOpenAIVideo(task)
	require.NoError(t, err)

	var payload map[string]any
	require.NoError(t, common.Unmarshal(data, &payload))
	require.Equal(t, "task_public", payload["id"])
	require.Equal(t, "task_public", payload["task_id"])
	metadata, ok := payload["metadata"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "https://cdn.example.com/result.mp4", metadata["url"])
}
