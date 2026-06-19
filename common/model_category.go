package common

import "strings"

// Model usage-scenario categories. A model may belong to multiple categories.
const (
	ModelCategoryText     = "text"
	ModelCategoryImage    = "image"
	ModelCategoryVideo    = "video"
	ModelCategoryAudioSTT = "audio_stt"
	ModelCategoryAudioTTS = "audio_tts"
)

// VideoGenerationModels holds substrings that identify video generation models.
// Matching is case-insensitive and substring based.
var VideoGenerationModels = []string{
	"sora",
	"kling",
	"veo",
	"runway",
	"vidu",
	"hailuo",
	"seedance",
	"cogvideo",
	"luma",
	"pika",
	"wan-video",
	"wanx-video",
	"-t2v",
	"-i2v",
	"-kf2v",
	"-s2v",
	"jimeng-video",
	"dreamina",
	"mochi",
	"ltx-video",
	"minimax-video",
	"video-",
	"-video",
}

// IsVideoGenerationModel reports whether the model name looks like a video
// generation model based on well-known name patterns.
func IsVideoGenerationModel(modelName string) bool {
	modelName = strings.ToLower(modelName)
	for _, m := range VideoGenerationModels {
		if strings.Contains(modelName, m) {
			return true
		}
	}
	return false
}

// classifyTag maps a single free-form tag to a known category, or "" if it
// does not indicate a usage scenario.
func classifyTag(tag string) string {
	switch strings.ToLower(strings.TrimSpace(tag)) {
	case "text", "chat", "llm", "文本", "对话", "聊天":
		return ModelCategoryText
	case "image", "images", "图片", "图像", "绘图", "绘画", "画图", "draw", "drawing":
		return ModelCategoryImage
	case "video", "videos", "视频", "影片":
		return ModelCategoryVideo
	case "stt", "asr", "transcribe", "transcription", "speech-to-text",
		"speech_to_text", "whisper", "语音转文字", "语音识别", "转写":
		return ModelCategoryAudioSTT
	case "tts", "text-to-speech", "text_to_speech", "speech", "voice",
		"文字转语音", "语音合成":
		return ModelCategoryAudioTTS
	}
	return ""
}

// ClassifyModelCategories derives the usage-scenario categories of a model by
// combining manually configured tags, configured endpoint types and the model
// name. Returns an ordered, de-duplicated slice (text, image, video order).
// Falls back to [text] when nothing else matches.
func ClassifyModelCategories(modelName string, tags []string, endpoints []string) []string {
	set := map[string]bool{}

	for _, tag := range tags {
		if c := classifyTag(tag); c != "" {
			set[c] = true
		}
	}

	for _, ep := range endpoints {
		switch strings.ToLower(strings.TrimSpace(ep)) {
		case "openai-video":
			set[ModelCategoryVideo] = true
		case "image-generation":
			set[ModelCategoryImage] = true
		}
	}

	if IsVideoGenerationModel(modelName) {
		set[ModelCategoryVideo] = true
	}
	if IsImageGenerationModel(modelName) {
		set[ModelCategoryImage] = true
	}

	if len(set) == 0 {
		set[ModelCategoryText] = true
	}

	ordered := make([]string, 0, len(set))
	for _, c := range []string{
		ModelCategoryText,
		ModelCategoryImage,
		ModelCategoryVideo,
		ModelCategoryAudioSTT,
		ModelCategoryAudioTTS,
	} {
		if set[c] {
			ordered = append(ordered, c)
		}
	}
	return ordered
}
