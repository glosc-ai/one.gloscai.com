package model

import "strings"

// GetMissingModels returns model names that are referenced in the system
func GetMissingModels() ([]string, error) {
	// 1. 获取所有已启用模型（去重）
	models := GetEnabledModels()
	if len(models) == 0 {
		return []string{}, nil
	}

	// 2. 查询已有的元数据模型名
	var existing []string
	if err := DB.Model(&Model{}).Where("model_name IN ?", models).Pluck("model_name", &existing).Error; err != nil {
		return nil, err
	}

	existingSet := make(map[string]struct{}, len(existing))
	for _, e := range existing {
		existingSet[e] = struct{}{}
	}

	// 3. 收集缺失模型
	var missing []string
	for _, name := range models {
		if _, ok := existingSet[name]; !ok {
			missing = append(missing, name)
		}
	}
	return missing, nil
}

func AddMissingModels(modelNames []string) ([]string, []string, error) {
	created := make([]string, 0, len(modelNames))
	skipped := make([]string, 0)
	seen := make(map[string]struct{}, len(modelNames))

	for _, rawModelName := range modelNames {
		modelName := strings.TrimSpace(rawModelName)
		if modelName == "" {
			continue
		}
		if _, ok := seen[modelName]; ok {
			continue
		}
		seen[modelName] = struct{}{}

		var count int64
		if err := DB.Model(&Model{}).Where("model_name = ?", modelName).Count(&count).Error; err != nil {
			return created, skipped, err
		}
		if count > 0 {
			skipped = append(skipped, modelName)
			continue
		}

		modelMeta := &Model{
			ModelName:    modelName,
			Status:       0,
			SyncOfficial: 1,
			NameRule:     NameRuleExact,
		}
		if err := modelMeta.Insert(); err != nil {
			skipped = append(skipped, modelName)
			continue
		}
		created = append(created, modelName)
	}

	return created, skipped, nil
}
