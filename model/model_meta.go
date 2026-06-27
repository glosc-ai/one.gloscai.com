package model

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

const (
	NameRuleExact = iota
	NameRulePrefix
	NameRuleContains
	NameRuleSuffix
)

// Billing types for a model. Default is per-call (the configured fixed price is
// charged once per request). Per-second multiplies the fixed price by the
// requested duration in seconds (used for video generation models).
const (
	BillingTypePerCall   = iota // 0: charge the fixed price once per call
	BillingTypePerSecond        // 1: charge fixed price × duration(seconds)
)

type BoundChannel struct {
	Name string `json:"name"`
	Type int    `json:"type"`
}

type Model struct {
	Id           int            `json:"id"`
	ModelName    string         `json:"model_name" gorm:"size:128;not null;uniqueIndex:uk_model_name_delete_at,priority:1"`
	Description  string         `json:"description,omitempty" gorm:"type:text"`
	Icon         string         `json:"icon,omitempty" gorm:"type:varchar(128)"`
	Tags         string         `json:"tags,omitempty" gorm:"type:varchar(255)"`
	Categories   string         `json:"categories,omitempty" gorm:"type:text"`
	VendorID     int            `json:"vendor_id,omitempty" gorm:"index"`
	Endpoints    string         `json:"endpoints,omitempty" gorm:"type:text"`
	Status       int            `json:"status" gorm:"default:1"`
	SyncOfficial int            `json:"sync_official" gorm:"default:1"`
	BillingType  int            `json:"billing_type" gorm:"default:0"`
	CreatedTime  int64          `json:"created_time" gorm:"bigint"`
	UpdatedTime  int64          `json:"updated_time" gorm:"bigint"`
	DeletedAt    gorm.DeletedAt `json:"-" gorm:"index;uniqueIndex:uk_model_name_delete_at,priority:2"`

	BoundChannels []BoundChannel `json:"bound_channels,omitempty" gorm:"-"`
	EnableGroups  []string       `json:"enable_groups,omitempty" gorm:"-"`
	QuotaTypes    []int          `json:"quota_types,omitempty" gorm:"-"`
	HasPrice      bool           `json:"has_price" gorm:"-"`
	NameRule      int            `json:"name_rule" gorm:"default:0"`

	MatchedModels []string `json:"matched_models,omitempty" gorm:"-"`
	MatchedCount  int      `json:"matched_count,omitempty" gorm:"-"`
}

type ModelsMetaFilter struct {
	Keyword      string
	Vendor       string
	Tag          string
	Category     string
	Status       *int
	SyncOfficial *int
	HasPrice     *bool
	SortBy       string
	SortOrder    string
}

var modelsMetaAllowedSorts = map[string]string{
	"id":            "models.id",
	"model_name":    "models.model_name",
	"created_time":  "models.created_time",
	"updated_time":  "models.updated_time",
	"status":        "models.status",
	"vendor_id":     "models.vendor_id",
	"sync_official": "models.sync_official",
}

func modelsMetaSortClause(sortBy string, sortOrder string) string {
	return safeSortClause(sortBy, modelsMetaAllowedSorts, "models.id", sortOrder)
}

func (mi *Model) Insert() error {
	now := common.GetTimestamp()
	mi.CreatedTime = now
	mi.UpdatedTime = now

	// 保存原始值（因为 Create 后可能被 GORM 的 default 标签覆盖为 1）
	originalStatus := mi.Status
	originalSyncOfficial := mi.SyncOfficial

	// 先创建记录（GORM 会对零值字段应用默认值）
	if err := DB.Create(mi).Error; err != nil {
		return err
	}

	// 使用保存的原始值进行更新，确保零值能正确保存
	return DB.Model(&Model{}).Where("id = ?", mi.Id).Updates(map[string]interface{}{
		"status":        originalStatus,
		"sync_official": originalSyncOfficial,
		"billing_type":  mi.BillingType,
	}).Error
}

func IsModelNameDuplicated(id int, name string) (bool, error) {
	if name == "" {
		return false, nil
	}
	var cnt int64
	err := DB.Model(&Model{}).Where("model_name = ? AND id <> ?", name, id).Count(&cnt).Error
	return cnt > 0, err
}

func (mi *Model) Update() error {
	mi.UpdatedTime = common.GetTimestamp()
	// 使用 Select 强制更新所有字段，包括零值
	return DB.Model(&Model{}).Where("id = ?", mi.Id).
		Select("model_name", "description", "icon", "tags", "categories", "vendor_id", "endpoints", "status", "sync_official", "billing_type", "name_rule", "updated_time").
		Updates(mi).Error
}

func BatchUpdateModelVendor(ids []int, vendorID int, icon *string) (int64, error) {
	updates := map[string]interface{}{
		"vendor_id":    vendorID,
		"updated_time": common.GetTimestamp(),
	}
	if icon != nil {
		updates["icon"] = *icon
	}
	result := DB.Model(&Model{}).Where("id IN ?", ids).Updates(updates)
	return result.RowsAffected, result.Error
}

func BatchUpdateModelCategoryTags(ids []int, categoryTags []string) (int64, error) {
	categoryTagSet := map[string]struct{}{
		"text":  {},
		"image": {},
		"video": {},
		"stt":   {},
		"tts":   {},
	}
	nextCategoryTags := make([]string, 0, len(categoryTags))
	seenCategoryTags := make(map[string]struct{}, len(categoryTags))
	for _, tag := range categoryTags {
		normalized := strings.ToLower(strings.TrimSpace(tag))
		if _, ok := categoryTagSet[normalized]; !ok {
			continue
		}
		if _, ok := seenCategoryTags[normalized]; ok {
			continue
		}
		seenCategoryTags[normalized] = struct{}{}
		nextCategoryTags = append(nextCategoryTags, normalized)
	}

	var updatedCount int64
	err := DB.Transaction(func(tx *gorm.DB) error {
		var models []Model
		if err := tx.Where("id IN ?", ids).Find(&models).Error; err != nil {
			return err
		}
		now := common.GetTimestamp()
		for _, modelMeta := range models {
			mergedTags := make([]string, 0)
			seenTags := make(map[string]struct{})
			for _, tag := range strings.Split(modelMeta.Tags, ",") {
				trimmed := strings.TrimSpace(tag)
				if trimmed == "" {
					continue
				}
				if _, ok := categoryTagSet[strings.ToLower(trimmed)]; ok {
					continue
				}
				if _, ok := seenTags[trimmed]; ok {
					continue
				}
				seenTags[trimmed] = struct{}{}
				mergedTags = append(mergedTags, trimmed)
			}
			for _, tag := range nextCategoryTags {
				if _, ok := seenTags[tag]; ok {
					continue
				}
				seenTags[tag] = struct{}{}
				mergedTags = append(mergedTags, tag)
			}

			result := tx.Model(&Model{}).Where("id = ?", modelMeta.Id).Updates(map[string]interface{}{
				"tags":         strings.Join(mergedTags, ","),
				"updated_time": now,
			})
			if result.Error != nil {
				return result.Error
			}
			updatedCount += result.RowsAffected
		}
		return nil
	})
	return updatedCount, err
}

func normalizeModelCategories(categories []string) []string {
	normalized := make([]string, 0, len(categories))
	seen := make(map[string]struct{}, len(categories))
	for _, category := range categories {
		for _, part := range strings.Split(category, ",") {
			value := strings.TrimSpace(part)
			if value == "" {
				continue
			}
			key := strings.ToLower(value)
			if _, ok := seen[key]; ok {
				continue
			}
			seen[key] = struct{}{}
			normalized = append(normalized, value)
		}
	}
	return normalized
}

func BatchUpdateModelCategories(ids []int, categories []string) (int64, error) {
	nextCategories := normalizeModelCategories(categories)
	result := DB.Model(&Model{}).Where("id IN ?", ids).Updates(map[string]interface{}{
		"categories":   strings.Join(nextCategories, ","),
		"updated_time": common.GetTimestamp(),
	})
	return result.RowsAffected, result.Error
}

func (mi *Model) Delete() error {
	return DB.Delete(mi).Error
}

func GetVendorModelCounts() (map[int64]int64, error) {
	var stats []struct {
		VendorID int64
		Count    int64
	}
	if err := DB.Model(&Model{}).
		Select("vendor_id as vendor_id, count(*) as count").
		Group("vendor_id").
		Scan(&stats).Error; err != nil {
		return nil, err
	}
	m := make(map[int64]int64, len(stats))
	for _, s := range stats {
		m[s.VendorID] = s.Count
	}
	return m, nil
}

func GetAllModels(offset int, limit int) ([]*Model, error) {
	var models []*Model
	err := DB.Order("id DESC").Offset(offset).Limit(limit).Find(&models).Error
	return models, err
}

func applyModelsMetaFilters(db *gorm.DB, filter ModelsMetaFilter) *gorm.DB {
	if filter.Keyword != "" {
		like := "%" + filter.Keyword + "%"
		db = db.Where("model_name LIKE ? OR description LIKE ? OR tags LIKE ? OR categories LIKE ?", like, like, like, like)
	}
	if filter.Vendor != "" {
		if vendorID, err := strconv.Atoi(filter.Vendor); err == nil {
			db = db.Where("models.vendor_id = ?", vendorID)
		} else {
			db = db.Joins("JOIN vendors ON vendors.id = models.vendor_id").Where("vendors.name LIKE ?", "%"+filter.Vendor+"%")
		}
	}
	if filter.Status != nil {
		db = db.Where("models.status = ?", *filter.Status)
	}
	if filter.SyncOfficial != nil {
		db = db.Where("models.sync_official = ?", *filter.SyncOfficial)
	}
	if filter.Tag != "" {
		if filter.Tag == "__empty__" {
			db = db.Where("models.tags IS NULL OR TRIM(models.tags) = ''")
		} else {
			db = db.Where(
				"models.tags = ? OR models.tags LIKE ? OR models.tags LIKE ? OR models.tags LIKE ?",
				filter.Tag,
				filter.Tag+",%",
				"%,"+filter.Tag,
				"%,"+filter.Tag+",%",
			)
		}
	}
	if filter.Category != "" {
		if filter.Category == "__empty__" {
			db = db.Where("models.categories IS NULL OR TRIM(models.categories) = ''")
		} else {
			db = db.Where(
				"models.categories = ? OR models.categories LIKE ? OR models.categories LIKE ? OR models.categories LIKE ?",
				filter.Category,
				filter.Category+",%",
				"%,"+filter.Category,
				"%,"+filter.Category+",%",
			)
		}
	}
	return db
}

func GetModelTagCounts(filter ModelsMetaFilter) (map[string]int64, error) {
	filter.Tag = ""
	db := applyModelsMetaFilters(DB.Model(&Model{}), filter)

	var models []Model
	if err := db.Select("tags").Find(&models).Error; err != nil {
		return nil, err
	}

	counts := make(map[string]int64)
	for _, modelMeta := range models {
		tags := strings.Split(modelMeta.Tags, ",")
		hasTag := false
		seen := make(map[string]struct{}, len(tags))
		for _, tag := range tags {
			tag = strings.TrimSpace(tag)
			if tag == "" {
				continue
			}
			if _, ok := seen[tag]; ok {
				continue
			}
			seen[tag] = struct{}{}
			counts[tag]++
			hasTag = true
		}
		if !hasTag {
			counts["__empty__"]++
		}
	}
	return counts, nil
}

func GetModelCategoryCounts(filter ModelsMetaFilter) (map[string]int64, error) {
	filter.Category = ""
	db := applyModelsMetaFilters(DB.Model(&Model{}), filter)

	var models []Model
	if err := db.Select("categories").Find(&models).Error; err != nil {
		return nil, err
	}

	counts := make(map[string]int64)
	for _, modelMeta := range models {
		categories := strings.Split(modelMeta.Categories, ",")
		hasCategory := false
		seen := make(map[string]struct{}, len(categories))
		for _, category := range categories {
			category = strings.TrimSpace(category)
			if category == "" {
				continue
			}
			if _, ok := seen[category]; ok {
				continue
			}
			seen[category] = struct{}{}
			counts[category]++
			hasCategory = true
		}
		if !hasCategory {
			counts["__empty__"]++
		}
	}
	return counts, nil
}

func ListModelsMeta(filter ModelsMetaFilter, offset int, limit int) ([]*Model, int64, error) {
	db := applyModelsMetaFilters(DB.Model(&Model{}), filter)
	orderClause := modelsMetaSortClause(filter.SortBy, filter.SortOrder)

	if filter.HasPrice == nil {
		var total int64
		if err := db.Count(&total).Error; err != nil {
			return nil, 0, err
		}
		var models []*Model
		if err := db.Order(orderClause).Offset(offset).Limit(limit).Find(&models).Error; err != nil {
			return nil, 0, err
		}
		return models, total, nil
	}

	var candidates []*Model
	if err := db.Order(orderClause).Find(&candidates).Error; err != nil {
		return nil, 0, err
	}

	pricingItems := GetPricing()
	filtered := make([]*Model, 0, len(candidates))
	for _, modelMeta := range candidates {
		modelMeta.HasPrice = ModelMetaHasBillingConfig(modelMeta, pricingItems)
		if modelMeta.HasPrice == *filter.HasPrice {
			filtered = append(filtered, modelMeta)
		}
	}

	total := int64(len(filtered))
	if offset >= len(filtered) {
		return []*Model{}, total, nil
	}
	end := offset + limit
	if limit <= 0 || end > len(filtered) {
		end = len(filtered)
	}
	return filtered[offset:end], total, nil
}

func GetBoundChannelsByModelsMap(modelNames []string) (map[string][]BoundChannel, error) {
	result := make(map[string][]BoundChannel)
	if len(modelNames) == 0 {
		return result, nil
	}
	type row struct {
		Model string
		Name  string
		Type  int
	}
	var rows []row
	err := DB.Table("channels").
		Select("abilities.model as model, channels.name as name, channels.type as type").
		Joins("JOIN abilities ON abilities.channel_id = channels.id").
		Where("abilities.model IN ? AND abilities.enabled = ?", modelNames, true).
		Distinct().
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		result[r.Model] = append(result[r.Model], BoundChannel{Name: r.Name, Type: r.Type})
	}
	return result, nil
}

func normalizeLookupValues(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	normalized := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		normalized = append(normalized, value)
	}
	return normalized
}

func GetPreferredModelOwnerChannelTypes(modelNames []string, groups []string) (map[string]int, error) {
	result := make(map[string]int)
	modelNames = normalizeLookupValues(modelNames)
	if len(modelNames) == 0 {
		return result, nil
	}

	type row struct {
		Model       string
		ChannelType int
	}
	var rows []row

	query := DB.Table("abilities").
		Select("abilities.model as model, channels.type as channel_type").
		Joins("JOIN channels ON abilities.channel_id = channels.id").
		Where("abilities.model IN ? AND abilities.enabled = ? AND channels.status = ?", modelNames, true, common.ChannelStatusEnabled).
		Order("COALESCE(abilities.priority, 0) DESC").
		Order("abilities.weight DESC").
		Order("abilities.channel_id ASC")

	groups = normalizeLookupValues(groups)
	if len(groups) > 0 {
		query = query.Where("abilities."+commonGroupCol+" IN ?", groups)
	}

	if err := query.Scan(&rows).Error; err != nil {
		return nil, err
	}

	for _, r := range rows {
		if _, ok := result[r.Model]; ok {
			continue
		}
		result[r.Model] = r.ChannelType
	}
	return result, nil
}

func SearchModels(keyword string, vendor string, offset int, limit int) ([]*Model, int64, error) {
	return ListModelsMeta(ModelsMetaFilter{Keyword: keyword, Vendor: vendor}, offset, limit)
}
