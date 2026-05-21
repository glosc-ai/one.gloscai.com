package model

import "strings"

// FilterModelNamesByMetaStatus removes models that are explicitly disabled in
// model metadata while keeping custom models that have no metadata entry.
func FilterModelNamesByMetaStatus(modelNames []string) ([]string, error) {
	if len(modelNames) == 0 {
		return []string{}, nil
	}

	uniqueNames := make([]string, 0, len(modelNames))
	seen := make(map[string]struct{}, len(modelNames))
	for _, modelName := range modelNames {
		if _, ok := seen[modelName]; ok {
			continue
		}
		seen[modelName] = struct{}{}
		uniqueNames = append(uniqueNames, modelName)
	}

	var exactModels []Model
	if err := DB.Model(&Model{}).
		Select("model_name", "status").
		Where("name_rule = ? AND model_name IN ?", NameRuleExact, uniqueNames).
		Find(&exactModels).Error; err != nil {
		return nil, err
	}

	exactStatus := make(map[string]int, len(exactModels))
	for _, modelMeta := range exactModels {
		exactStatus[modelMeta.ModelName] = modelMeta.Status
	}

	var ruleModels []Model
	if err := DB.Model(&Model{}).
		Select("model_name", "status", "name_rule").
		Where("name_rule <> ?", NameRuleExact).
		Order("id ASC").
		Find(&ruleModels).Error; err != nil {
		return nil, err
	}

	filtered := make([]string, 0, len(modelNames))
	for _, modelName := range modelNames {
		if status, ok := exactStatus[modelName]; ok {
			if status == 1 {
				filtered = append(filtered, modelName)
			}
			continue
		}

		include := true
		for _, modelMeta := range ruleModels {
			if !modelMeta.matches(modelName) {
				continue
			}
			include = modelMeta.Status == 1
			break
		}

		if include {
			filtered = append(filtered, modelName)
		}
	}

	return filtered, nil
}

func (mi *Model) matches(modelName string) bool {
	switch mi.NameRule {
	case NameRulePrefix:
		return strings.HasPrefix(modelName, mi.ModelName)
	case NameRuleSuffix:
		return strings.HasSuffix(modelName, mi.ModelName)
	case NameRuleContains:
		return strings.Contains(modelName, mi.ModelName)
	default:
		return modelName == mi.ModelName
	}
}
