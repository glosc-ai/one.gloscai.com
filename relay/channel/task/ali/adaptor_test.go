package ali

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func testRelayInfo(model string) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		OriginModelName: model,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: model,
		},
	}
}

func TestConvertToAliRequestWan27I2VUsesMedia(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:          "wan2.7-i2v-2026-04-25",
		Prompt:         "make the subject move",
		InputReference: "https://example.com/first.png",
		Duration:       5,
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(req.Model), req)
	if err != nil {
		t.Fatalf("convertToAliRequest() error = %v", err)
	}

	if got := aliReq.Input.ImgURL; got != "" {
		t.Fatalf("ImgURL = %q, want empty for wan2.7-i2v", got)
	}
	if len(aliReq.Input.Media) != 1 {
		t.Fatalf("len(Media) = %d, want 1", len(aliReq.Input.Media))
	}
	if got := aliReq.Input.Media[0].Type; got != "first_frame" {
		t.Fatalf("Media[0].Type = %q, want first_frame", got)
	}
	if got := aliReq.Input.Media[0].URL; got != req.InputReference {
		t.Fatalf("Media[0].URL = %q, want %q", got, req.InputReference)
	}
	if got := aliReq.Parameters.Resolution; got != "720P" {
		t.Fatalf("Resolution = %q, want 720P", got)
	}
}

func TestConvertToAliRequestWan27I2VUsesImageFallback(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:    "wan2.7-i2v-2026-04-25",
		Prompt:   "make the subject move",
		Image:    "https://example.com/image.png",
		Duration: 5,
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(req.Model), req)
	if err != nil {
		t.Fatalf("convertToAliRequest() error = %v", err)
	}

	if len(aliReq.Input.Media) != 1 {
		t.Fatalf("len(Media) = %d, want 1", len(aliReq.Input.Media))
	}
	if got := aliReq.Input.Media[0].URL; got != req.Image {
		t.Fatalf("Media[0].URL = %q, want %q", got, req.Image)
	}
}

func TestConvertToAliRequestWan27I2VUsesMetadataImageFallback(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:    "wan2.7-i2v-2026-04-25",
		Prompt:   "make the subject move",
		Duration: 5,
		Metadata: map[string]interface{}{
			"input": map[string]interface{}{
				"img_url": "https://example.com/metadata-image.png",
			},
		},
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(req.Model), req)
	if err != nil {
		t.Fatalf("convertToAliRequest() error = %v", err)
	}

	if len(aliReq.Input.Media) != 1 {
		t.Fatalf("len(Media) = %d, want 1", len(aliReq.Input.Media))
	}
	if got := aliReq.Input.Media[0].URL; got != "https://example.com/metadata-image.png" {
		t.Fatalf("Media[0].URL = %q", got)
	}
}

func TestConvertToAliRequestWan27I2VUsesUpstreamModelCandidate(t *testing.T) {
	adaptor := &TaskAdaptor{}
	info := testRelayInfo("wan2.7-i2v-2026-04-25")
	req := relaycommon.TaskSubmitReq{
		Model:          "ali-video-alias",
		Prompt:         "make the subject move",
		InputReference: "https://example.com/first.png",
		Duration:       5,
	}

	aliReq, err := adaptor.convertToAliRequest(info, req)
	if err != nil {
		t.Fatalf("convertToAliRequest() error = %v", err)
	}

	if got := aliReq.Model; got != "wan2.7-i2v-2026-04-25" {
		t.Fatalf("Model = %q, want upstream model", got)
	}
	if len(aliReq.Input.Media) != 1 {
		t.Fatalf("len(Media) = %d, want 1", len(aliReq.Input.Media))
	}
	if got := aliReq.Input.Media[0].URL; got != req.InputReference {
		t.Fatalf("Media[0].URL = %q, want %q", got, req.InputReference)
	}
	if got := aliReq.Input.ImgURL; got != "" {
		t.Fatalf("ImgURL = %q, want empty for wan2.7-i2v", got)
	}
}

func TestConvertToAliRequestWan27Image2VideoUsesMedia(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:    "wan2.7-image2video-2026-04-25",
		Prompt:   "make the subject move",
		Image:    "https://example.com/image.png",
		Duration: 5,
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(req.Model), req)
	if err != nil {
		t.Fatalf("convertToAliRequest() error = %v", err)
	}

	if len(aliReq.Input.Media) != 1 {
		t.Fatalf("len(Media) = %d, want 1", len(aliReq.Input.Media))
	}
	if got := aliReq.Input.Media[0].Type; got != "first_frame" {
		t.Fatalf("Media[0].Type = %q, want first_frame", got)
	}
	if got := aliReq.Input.Media[0].URL; got != req.Image {
		t.Fatalf("Media[0].URL = %q, want %q", got, req.Image)
	}
}

func TestConvertToAliRequestWan27NormalizesResolution(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:    "wan2.7-i2v-2026-04-25",
		Prompt:   "make the subject move",
		Duration: 5,
		Metadata: map[string]interface{}{
			"input": map[string]interface{}{
				"media": []interface{}{
					map[string]interface{}{
						"type": "first_frame",
						"url":  "https://example.com/first.png",
					},
				},
			},
			"parameters": map[string]interface{}{
				"resolution": "480P",
			},
		},
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(req.Model), req)
	if err != nil {
		t.Fatalf("convertToAliRequest() error = %v", err)
	}

	if got := aliReq.Parameters.Resolution; got != "720P" {
		t.Fatalf("Resolution = %q, want 720P", got)
	}
	if got := aliReq.Parameters.Size; got != "" {
		t.Fatalf("Size = %q, want empty for wan2.7", got)
	}
}
