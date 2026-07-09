package volcengine

var ModelList = []string{
	"Doubao-pro-128k",
	"Doubao-pro-32k",
	"Doubao-pro-4k",
	"Doubao-lite-128k",
	"Doubao-lite-32k",
	"Doubao-lite-4k",
	"Doubao-embedding",
	"doubao-seedream-4-0-250828",
	"seedream-4-0-250828",
	"doubao-seedance-1-0-pro-250528",
	"seedance-1-0-pro-250528",
	"doubao-seed-1-6-thinking-250715",
	"seed-1-6-thinking-250715",
}

var AgentPlanModelList = []string{
	"doubao-seed-2.0-mini",
	"doubao-seed-2.0-lite",
	"doubao-seed-2.0-code",
	"doubao-seed-2.0-pro",
	"deepseek-v4-flash",
	"deepseek-v4-pro",
	"doubao-embedding-vision",
	"doubao-seedream-5.0-lite",
	"doubao-seedream-5-0-lite-260128",
	"doubao-seedance-1.5-pro",
	"doubao-seedance-1-5-pro-251215",
	"doubao-seedance-2.0",
	"doubao-seedance-2-0-260128",
	"doubao-seedance-2.0-fast",
	"doubao-seedance-2-0-fast-260128",
	"doubao-seedance-2.0-mini",
	"doubao-seed-tts-2.0",
}

var ChannelName = "volcengine"
var AgentPlanChannelName = "volcengine-agent-plan"

const (
	AgentPlanDefaultBaseURL = "https://ark.cn-beijing.volces.com/api/plan/v3"
	AgentPlanTTSHTTPURL     = "https://openspeech.bytedance.com/api/v3/plan/tts/unidirectional"
)
