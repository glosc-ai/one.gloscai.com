package model

import (
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

// ModelCategoryInfo describes the usage-scenario classification of a model.
type ModelCategoryInfo struct {
	ModelName  string   `json:"model_name"`
	Tags       []string `json:"tags"`
	Categories []string `json:"categories"`
}

// metaForModelName resolves the configured tags/endpoints for a model name by
// first looking up an exact metadata entry and then falling back to rule-based
// (prefix/suffix/contains) entries. Returns empty strings when no entry exists.
func metaForModelName(modelName string, exact map[string]Model, ruleModels []Model) (tags string, endpoints string) {
	if m, ok := exact[modelName]; ok {
		return m.Tags, m.Endpoints
	}
	for _, m := range ruleModels {
		if m.matches(modelName) {
			return m.Tags, m.Endpoints
		}
	}
	return "", ""
}

func parseTagsCSV(tags string) []string {
	if strings.TrimSpace(tags) == "" {
		return nil
	}
	parts := strings.Split(tags, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func parseEndpointsJSON(endpoints string) []string {
	endpoints = strings.TrimSpace(endpoints)
	if endpoints == "" {
		return nil
	}
	var out []string
	if err := common.UnmarshalJsonStr(endpoints, &out); err != nil {
		return nil
	}
	return out
}

// GetModelsCategoryInfo classifies each provided model name into usage-scenario
// categories (text/image/video), combining configured metadata tags/endpoints
// with name-based inference.
func GetModelsCategoryInfo(modelNames []string) ([]ModelCategoryInfo, error) {
	if len(modelNames) == 0 {
		return []ModelCategoryInfo{}, nil
	}

	uniqueNames := make([]string, 0, len(modelNames))
	seen := make(map[string]struct{}, len(modelNames))
	for _, name := range modelNames {
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		uniqueNames = append(uniqueNames, name)
	}

	var exactModels []Model
	if err := DB.Model(&Model{}).
		Select("model_name", "tags", "endpoints").
		Where("name_rule = ? AND model_name IN ?", NameRuleExact, uniqueNames).
		Find(&exactModels).Error; err != nil {
		return nil, err
	}
	exact := make(map[string]Model, len(exactModels))
	for _, m := range exactModels {
		exact[m.ModelName] = m
	}

	var ruleModels []Model
	if err := DB.Model(&Model{}).
		Select("model_name", "tags", "endpoints", "name_rule").
		Where("name_rule <> ?", NameRuleExact).
		Order("id ASC").
		Find(&ruleModels).Error; err != nil {
		return nil, err
	}

	result := make([]ModelCategoryInfo, 0, len(uniqueNames))
	for _, name := range uniqueNames {
		tagsCSV, endpointsJSON := metaForModelName(name, exact, ruleModels)
		tags := parseTagsCSV(tagsCSV)
		endpoints := parseEndpointsJSON(endpointsJSON)
		categories := common.ClassifyModelCategories(name, tags, endpoints)
		result = append(result, ModelCategoryInfo{
			ModelName:  name,
			Tags:       tags,
			Categories: categories,
		})
	}

	sort.Slice(result, func(i, j int) bool {
		left := strings.ToLower(result[i].ModelName)
		right := strings.ToLower(result[j].ModelName)
		if left == right {
			return result[i].ModelName < result[j].ModelName
		}
		return left < right
	})

	return result, nil
}

// GetModelBillingType returns the configured billing type for a model name,
// resolving exact metadata first and then rule-based (prefix/suffix/contains)
// entries. Returns BillingTypePerCall when no metadata entry exists.
func GetModelBillingType(modelName string) int {
	var exactModels []Model
	if err := DB.Model(&Model{}).
		Select("model_name", "billing_type").
		Where("name_rule = ? AND model_name = ?", NameRuleExact, modelName).
		Find(&exactModels).Error; err == nil && len(exactModels) > 0 {
		return exactModels[0].BillingType
	}

	var ruleModels []Model
	if err := DB.Model(&Model{}).
		Select("model_name", "billing_type", "name_rule").
		Where("name_rule <> ?", NameRuleExact).
		Order("id ASC").
		Find(&ruleModels).Error; err == nil {
		for _, m := range ruleModels {
			if m.matches(modelName) {
				return m.BillingType
			}
		}
	}
	return BillingTypePerCall
}
