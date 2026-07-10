package model

import (
	"strings"
)

type defaultVendorRule struct {
	Pattern    string
	VendorName string
}

// Keep the rules ordered so overlapping model families are resolved consistently.
var defaultVendorRules = []defaultVendorRule{
	{Pattern: "gpt", VendorName: "OpenAI"},
	{Pattern: "dall-e", VendorName: "OpenAI"},
	{Pattern: "whisper", VendorName: "OpenAI"},
	{Pattern: "o1", VendorName: "OpenAI"},
	{Pattern: "o3", VendorName: "OpenAI"},
	{Pattern: "claude", VendorName: "Anthropic"},
	{Pattern: "gemini", VendorName: "Google"},
	{Pattern: "moonshot", VendorName: "Moonshot"},
	{Pattern: "kimi", VendorName: "Moonshot"},
	{Pattern: "chatglm", VendorName: "智谱"},
	{Pattern: "glm-", VendorName: "智谱"},
	{Pattern: "qwen", VendorName: "阿里巴巴"},
	{Pattern: "deepseek", VendorName: "DeepSeek"},
	{Pattern: "abab", VendorName: "MiniMax"},
	{Pattern: "ernie", VendorName: "百度"},
	{Pattern: "spark", VendorName: "讯飞"},
	{Pattern: "hunyuan", VendorName: "腾讯"},
	{Pattern: "command", VendorName: "Cohere"},
	{Pattern: "@cf/", VendorName: "Cloudflare"},
	{Pattern: "360", VendorName: "360"},
	{Pattern: "yi", VendorName: "零一万物"},
	{Pattern: "jina", VendorName: "Jina"},
	{Pattern: "mistral", VendorName: "Mistral"},
	{Pattern: "grok", VendorName: "xAI"},
	{Pattern: "llama", VendorName: "Meta"},
	{Pattern: "doubao", VendorName: "字节跳动"},
	{Pattern: "kling", VendorName: "快手"},
	{Pattern: "jimeng", VendorName: "即梦"},
	{Pattern: "vidu", VendorName: "Vidu"},
}

func inferDefaultVendorName(modelName string) string {
	modelLower := strings.ToLower(strings.TrimSpace(modelName))
	for _, rule := range defaultVendorRules {
		if strings.Contains(modelLower, rule.Pattern) {
			return rule.VendorName
		}
	}
	return ""
}

// 供应商默认图标映射
var defaultVendorIcons = map[string]string{
	"OpenAI":     "OpenAI",
	"Anthropic":  "Claude.Color",
	"Google":     "Gemini.Color",
	"Moonshot":   "Moonshot",
	"智谱":         "Zhipu.Color",
	"阿里巴巴":       "Qwen.Color",
	"DeepSeek":   "DeepSeek.Color",
	"MiniMax":    "Minimax.Color",
	"百度":         "Wenxin.Color",
	"讯飞":         "Spark.Color",
	"腾讯":         "Hunyuan.Color",
	"Cohere":     "Cohere.Color",
	"Cloudflare": "Cloudflare.Color",
	"360":        "Ai360.Color",
	"零一万物":       "Yi.Color",
	"Jina":       "Jina",
	"Mistral":    "Mistral.Color",
	"xAI":        "XAI",
	"Meta":       "Ollama",
	"字节跳动":       "Doubao.Color",
	"快手":         "Kling.Color",
	"即梦":         "Jimeng.Color",
	"Vidu":       "Vidu",
	"微软":         "AzureAI",
	"Microsoft":  "AzureAI",
	"Azure":      "AzureAI",
}

// initDefaultVendorMapping 简化的默认供应商映射
func initDefaultVendorMapping(metaMap map[string]*Model, vendorMap map[int]*Vendor, enableAbilities []AbilityWithChannel) {
	for _, ability := range enableAbilities {
		modelName := ability.Model
		if _, exists := metaMap[modelName]; exists {
			continue
		}

		// 匹配供应商
		vendorID := 0
		if vendorName := inferDefaultVendorName(modelName); vendorName != "" {
			vendorID = getOrCreateVendor(vendorName, vendorMap)
		}

		// 创建模型元数据
		metaMap[modelName] = &Model{
			ModelName: modelName,
			VendorID:  vendorID,
			Status:    1,
			NameRule:  NameRuleExact,
		}
	}
}

// 查找或创建供应商
func getOrCreateVendor(vendorName string, vendorMap map[int]*Vendor) int {
	// 查找现有供应商
	for id, vendor := range vendorMap {
		if vendor.Name == vendorName || vendor.Alias == vendorName {
			return id
		}
	}

	// 管理员删除的默认供应商保持删除状态，除非之后手动重新创建。
	var deletedCount int64
	if err := DB.Unscoped().Model(&Vendor{}).
		Where("name = ? AND deleted_at IS NOT NULL", vendorName).
		Count(&deletedCount).Error; err == nil && deletedCount > 0 {
		return 0
	}

	// 创建新供应商
	newVendor := &Vendor{
		Name:   vendorName,
		Status: 1,
		Icon:   getDefaultVendorIcon(vendorName),
	}

	if err := newVendor.Insert(); err != nil {
		return 0
	}

	vendorMap[newVendor.Id] = newVendor
	return newVendor.Id
}

// 获取供应商默认图标
func getDefaultVendorIcon(vendorName string) string {
	if icon, exists := defaultVendorIcons[vendorName]; exists {
		return icon
	}
	return ""
}
