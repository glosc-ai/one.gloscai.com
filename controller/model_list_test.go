package controller

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type listModelsResponse struct {
	Success bool               `json:"success"`
	Data    []dto.OpenAIModels `json:"data"`
	Object  string             `json:"object"`
}

type userModelsResponse struct {
	Success bool     `json:"success"`
	Data    []string `json:"data"`
}

type categorizedModelsResponse struct {
	Success bool                      `json:"success"`
	Data    []model.ModelCategoryInfo `json:"data"`
}

type batchUpdateVendorResponse struct {
	Success bool `json:"success"`
	Data    struct {
		UpdatedCount int64 `json:"updated_count"`
	} `json:"data"`
}

type getModelsMetaResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Items []model.Model `json:"items"`
		Total int64         `json:"total"`
	} `json:"data"`
}

type addMissingModelsResponse struct {
	Success bool `json:"success"`
	Data    struct {
		CreatedModels int      `json:"created_models"`
		SkippedModels []string `json:"skipped_models"`
		CreatedList   []string `json:"created_list"`
	} `json:"data"`
}

func setupModelListControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	initModelListColumnNames(t)

	gin.SetMode(gin.TestMode)
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db

	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Channel{}, &model.Ability{}, &model.Model{}, &model.Vendor{}))

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func initModelListColumnNames(t *testing.T) {
	t.Helper()

	originalIsMasterNode := common.IsMasterNode
	originalSQLitePath := common.SQLitePath
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalSQLDSN, hadSQLDSN := os.LookupEnv("SQL_DSN")
	defer func() {
		common.IsMasterNode = originalIsMasterNode
		common.SQLitePath = originalSQLitePath
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		if hadSQLDSN {
			require.NoError(t, os.Setenv("SQL_DSN", originalSQLDSN))
		} else {
			require.NoError(t, os.Unsetenv("SQL_DSN"))
		}
	}()

	common.IsMasterNode = false
	common.SQLitePath = fmt.Sprintf("file:%s_init?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	common.UsingSQLite = false
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	require.NoError(t, os.Setenv("SQL_DSN", "local"))

	require.NoError(t, model.InitDB())
	if model.DB != nil {
		sqlDB, err := model.DB.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	}
}

func withTieredBillingConfig(t *testing.T, modes map[string]string, exprs map[string]string) {
	t.Helper()

	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		if strings.HasPrefix(key, "billing_setting.") {
			saved[key] = value
		}
		return nil
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
		model.InvalidatePricingCache()
	})

	modeBytes, err := common.Marshal(modes)
	require.NoError(t, err)
	exprBytes, err := common.Marshal(exprs)
	require.NoError(t, err)

	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": string(modeBytes),
		"billing_setting.billing_expr": string(exprBytes),
	}))
	model.InvalidatePricingCache()
}

func withSelfUseModeDisabled(t *testing.T) {
	t.Helper()

	original := operation_setting.SelfUseModeEnabled
	operation_setting.SelfUseModeEnabled = false
	t.Cleanup(func() {
		operation_setting.SelfUseModeEnabled = original
	})
}

func withSelfUseModeEnabled(t *testing.T) {
	t.Helper()

	original := operation_setting.SelfUseModeEnabled
	operation_setting.SelfUseModeEnabled = true
	t.Cleanup(func() {
		operation_setting.SelfUseModeEnabled = original
	})
}

func decodeListModelsResponse(t *testing.T, recorder *httptest.ResponseRecorder) map[string]struct{} {
	t.Helper()

	data := decodeListModelsData(t, recorder)
	ids := make(map[string]struct{}, len(data))
	for _, item := range data {
		ids[item.Id] = struct{}{}
	}
	return ids
}

func decodeListModelsData(t *testing.T, recorder *httptest.ResponseRecorder) []dto.OpenAIModels {
	t.Helper()

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload listModelsResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.Equal(t, "list", payload.Object)
	return payload.Data
}

func decodeUserModelsResponse(t *testing.T, recorder *httptest.ResponseRecorder) []string {
	t.Helper()

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload userModelsResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	return payload.Data
}

func decodeCategorizedModelsResponse(t *testing.T, recorder *httptest.ResponseRecorder) []model.ModelCategoryInfo {
	t.Helper()

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload categorizedModelsResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	return payload.Data
}

func pricingByModelName(pricings []model.Pricing) map[string]model.Pricing {
	byName := make(map[string]model.Pricing, len(pricings))
	for _, pricing := range pricings {
		byName[pricing.ModelName] = pricing
	}
	return byName
}

func TestGetUserModelsFiltersDisabledModelsAndSorts(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.Create(&model.User{
		Id:       1002,
		Username: "playground-model-user",
		Password: "password",
		Group:    "default",
		Status:   common.UserStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "default", Model: "zeta-custom", ChannelId: 1, Enabled: true},
		{Group: "default", Model: "beta-disabled", ChannelId: 1, Enabled: true},
		{Group: "default", Model: "alpha-enabled", ChannelId: 1, Enabled: true},
		{Group: "default", Model: "blocked-model", ChannelId: 1, Enabled: true},
	}).Error)
	require.NoError(t, (&model.Model{
		ModelName: "beta-disabled",
		Status:    0,
		NameRule:  model.NameRuleExact,
	}).Insert())
	require.NoError(t, (&model.Model{
		ModelName: "blocked-",
		Status:    0,
		NameRule:  model.NameRulePrefix,
	}).Insert())
	require.NoError(t, (&model.Model{
		ModelName: "alpha-enabled",
		Status:    1,
		NameRule:  model.NameRuleExact,
	}).Insert())

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user/models", nil)
	ctx.Set("id", 1002)

	GetUserModels(ctx)

	require.Equal(t, []string{"alpha-enabled", "zeta-custom"}, decodeUserModelsResponse(t, recorder))
}

func TestGetUserModelsCategorizedIncludesPreferredChannelType(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.Create(&model.User{
		Id:       1006,
		Username: "categorized-channel-user",
		Password: "password",
		Group:    "default",
		Status:   common.UserStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&[]model.Channel{
		{Id: 1, Type: constant.ChannelTypeOpenAI, Key: "openai-key", Status: common.ChannelStatusEnabled, Name: "openai"},
		{Id: 2, Type: constant.ChannelTypeAli, Key: "ali-key", Status: common.ChannelStatusEnabled, Name: "ali"},
	}).Error)
	lowPriority := int64(1)
	highPriority := int64(2)
	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "default", Model: "mapped-video-model", ChannelId: 1, Enabled: true, Priority: &lowPriority, Weight: 100},
		{Group: "default", Model: "mapped-video-model", ChannelId: 2, Enabled: true, Priority: &highPriority, Weight: 0},
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user/models/categorized", nil)
	ctx.Set("id", 1006)

	GetUserModelsCategorized(ctx)

	items := decodeCategorizedModelsResponse(t, recorder)
	require.Len(t, items, 1)
	require.Equal(t, "mapped-video-model", items[0].ModelName)
	require.Equal(t, constant.ChannelTypeAli, items[0].ChannelType)
	require.Equal(t, constant.ChannelTypeNames[constant.ChannelTypeAli], items[0].ChannelTypeName)
	require.Equal(t, constant.ChannelTypeAli, items[0].ChannelTypesByGroup["default"])
	require.Equal(t, constant.ChannelTypeNames[constant.ChannelTypeAli], items[0].ChannelTypeNamesByGroup["default"])
}

func TestListModelsFiltersDisabledModelMetadata(t *testing.T) {
	withSelfUseModeEnabled(t)

	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.Create(&model.User{
		Id:       1003,
		Username: "v1-model-list-user",
		Password: "password",
		Group:    "default",
		Status:   common.UserStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "default", Model: "alpha-enabled", ChannelId: 1, Enabled: true},
		{Group: "default", Model: "beta-disabled", ChannelId: 1, Enabled: true},
		{Group: "default", Model: "blocked-model", ChannelId: 1, Enabled: true},
		{Group: "default", Model: "zeta-custom", ChannelId: 1, Enabled: true},
	}).Error)
	require.NoError(t, (&model.Model{
		ModelName: "beta-disabled",
		Status:    0,
		NameRule:  model.NameRuleExact,
	}).Insert())
	require.NoError(t, (&model.Model{
		ModelName: "blocked-",
		Status:    0,
		NameRule:  model.NameRulePrefix,
	}).Insert())
	require.NoError(t, (&model.Model{
		ModelName: "alpha-enabled",
		Status:    1,
		NameRule:  model.NameRuleExact,
	}).Insert())

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	ctx.Set("id", 1003)

	ListModels(ctx, constant.ChannelTypeOpenAI)

	ids := decodeListModelsResponse(t, recorder)
	require.Contains(t, ids, "alpha-enabled")
	require.Contains(t, ids, "zeta-custom")
	require.NotContains(t, ids, "beta-disabled")
	require.NotContains(t, ids, "blocked-model")
}

func TestListModelsIncludesCategories(t *testing.T) {
	withSelfUseModeEnabled(t)

	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.Create(&model.User{
		Id:       1004,
		Username: "v1-model-categories-user",
		Password: "password",
		Group:    "default",
		Status:   common.UserStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "default", Model: "categorized-default", ChannelId: 1, Enabled: true},
		{Group: "default", Model: "categorized-image", ChannelId: 1, Enabled: true},
		{Group: "default", Model: "categorized-video", ChannelId: 1, Enabled: true},
	}).Error)

	videoEndpoints, err := common.Marshal([]string{string(constant.EndpointTypeOpenAIVideo)})
	require.NoError(t, err)
	require.NoError(t, (&model.Model{
		ModelName: "categorized-image",
		Tags:      "image,custom",
		Status:    1,
		NameRule:  model.NameRuleExact,
	}).Insert())
	require.NoError(t, (&model.Model{
		ModelName: "categorized-video",
		Endpoints: string(videoEndpoints),
		Status:    1,
		NameRule:  model.NameRuleExact,
	}).Insert())

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	ctx.Set("id", 1004)

	ListModels(ctx, constant.ChannelTypeOpenAI)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload listModelsResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	modelsByID := make(map[string]dto.OpenAIModels, len(payload.Data))
	for _, item := range payload.Data {
		modelsByID[item.Id] = item
	}
	require.Equal(t, []string{"text"}, modelsByID["categorized-default"].Categories)
	require.Equal(t, []string{"image"}, modelsByID["categorized-image"].Categories)
	require.Equal(t, []string{"video"}, modelsByID["categorized-video"].Categories)
}

func TestListModelsSortsAlphabetically(t *testing.T) {
	withSelfUseModeEnabled(t)

	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.Create(&model.User{
		Id:       1005,
		Username: "v1-model-sorted-user",
		Password: "password",
		Group:    "default",
		Status:   common.UserStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "default", Model: "zeta-model", ChannelId: 1, Enabled: true},
		{Group: "default", Model: "Alpha-model", ChannelId: 1, Enabled: true},
		{Group: "default", Model: "beta-model", ChannelId: 1, Enabled: true},
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	ctx.Set("id", 1005)

	ListModels(ctx, constant.ChannelTypeOpenAI)

	data := decodeListModelsData(t, recorder)
	ids := make([]string, 0, len(data))
	for _, item := range data {
		ids = append(ids, item.Id)
	}
	require.Equal(t, []string{"Alpha-model", "beta-model", "zeta-model"}, ids)
}

func TestBatchUpdateModelVendor(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	vendor := model.Vendor{Name: "batch-vendor", Icon: "OpenAI", Status: 1}
	require.NoError(t, vendor.Insert())

	firstModel := model.Model{ModelName: "batch-vendor-alpha", Icon: "old-icon", Status: 1}
	secondModel := model.Model{ModelName: "batch-vendor-beta", Icon: "old-icon", Status: 1}
	require.NoError(t, firstModel.Insert())
	require.NoError(t, secondModel.Insert())

	body, err := common.Marshal(gin.H{
		"ids":       []int{firstModel.Id, secondModel.Id},
		"vendor_id": vendor.Id,
		"icon":      vendor.Icon,
	})
	require.NoError(t, err)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPut, "/api/models/batch_vendor", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	BatchUpdateModelVendor(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload batchUpdateVendorResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.Equal(t, int64(2), payload.Data.UpdatedCount)

	var updatedModels []model.Model
	require.NoError(t, db.Where("id IN ?", []int{firstModel.Id, secondModel.Id}).Find(&updatedModels).Error)
	require.Len(t, updatedModels, 2)
	for _, updatedModel := range updatedModels {
		require.Equal(t, vendor.Id, updatedModel.VendorID)
		require.Equal(t, vendor.Icon, updatedModel.Icon)
	}

	clearBody, err := common.Marshal(gin.H{
		"ids":       []int{firstModel.Id, secondModel.Id},
		"vendor_id": 0,
		"icon":      "",
	})
	require.NoError(t, err)

	clearRecorder := httptest.NewRecorder()
	clearCtx, _ := gin.CreateTestContext(clearRecorder)
	clearCtx.Request = httptest.NewRequest(http.MethodPut, "/api/models/batch_vendor", bytes.NewReader(clearBody))
	clearCtx.Request.Header.Set("Content-Type", "application/json")

	BatchUpdateModelVendor(clearCtx)

	require.Equal(t, http.StatusOK, clearRecorder.Code)
	updatedModels = nil
	require.NoError(t, db.Where("id IN ?", []int{firstModel.Id, secondModel.Id}).Find(&updatedModels).Error)
	require.Len(t, updatedModels, 2)
	for _, updatedModel := range updatedModels {
		require.Zero(t, updatedModel.VendorID)
		require.Empty(t, updatedModel.Icon)
	}
}

func TestBatchUpdateModelCategoryTags(t *testing.T) {
	db := setupModelListControllerTestDB(t)

	firstModel := model.Model{ModelName: "batch-tags-alpha", Tags: "legacy,text,custom", Status: 1}
	secondModel := model.Model{ModelName: "batch-tags-beta", Tags: "image,custom", Status: 1}
	require.NoError(t, firstModel.Insert())
	require.NoError(t, secondModel.Insert())

	body, err := common.Marshal(gin.H{
		"ids":  []int{firstModel.Id, secondModel.Id},
		"tags": []string{"video", "image"},
	})
	require.NoError(t, err)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPut, "/api/models/batch_tags", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	BatchUpdateModelCategoryTags(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload batchUpdateVendorResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.Equal(t, int64(2), payload.Data.UpdatedCount)

	var updatedModels []model.Model
	require.NoError(t, db.Where("id IN ?", []int{firstModel.Id, secondModel.Id}).Order("model_name ASC").Find(&updatedModels).Error)
	require.Len(t, updatedModels, 2)
	require.Equal(t, "legacy,custom,video,image", updatedModels[0].Tags)
	require.Equal(t, "custom,video,image", updatedModels[1].Tags)

	clearBody, err := common.Marshal(gin.H{
		"ids":  []int{firstModel.Id, secondModel.Id},
		"tags": []string{},
	})
	require.NoError(t, err)

	clearRecorder := httptest.NewRecorder()
	clearCtx, _ := gin.CreateTestContext(clearRecorder)
	clearCtx.Request = httptest.NewRequest(http.MethodPut, "/api/models/batch_tags", bytes.NewReader(clearBody))
	clearCtx.Request.Header.Set("Content-Type", "application/json")

	BatchUpdateModelCategoryTags(clearCtx)

	require.Equal(t, http.StatusOK, clearRecorder.Code)
	updatedModels = nil
	require.NoError(t, db.Where("id IN ?", []int{firstModel.Id, secondModel.Id}).Order("model_name ASC").Find(&updatedModels).Error)
	require.Len(t, updatedModels, 2)
	require.Equal(t, "legacy,custom", updatedModels[0].Tags)
	require.Equal(t, "custom", updatedModels[1].Tags)
}

func TestGetAllModelsMetaFiltersStatusSyncAndPrice(t *testing.T) {
	withSelfUseModeDisabled(t)
	withTieredBillingConfig(t, map[string]string{
		"priced-enabled-sync": "tiered_expr",
	}, map[string]string{
		"priced-enabled-sync": `tier("default", 1)`,
	})

	setupModelListControllerTestDB(t)
	records := []*model.Model{
		{ModelName: "priced-enabled-sync", Status: 1, SyncOfficial: 1, NameRule: model.NameRuleExact},
		{ModelName: "unpriced-disabled-sync", Status: 0, SyncOfficial: 1, NameRule: model.NameRuleExact},
		{ModelName: "unpriced-enabled-nosync", Status: 1, SyncOfficial: 0, NameRule: model.NameRuleExact},
		{ModelName: "unpriced-enabled-sync", Status: 1, SyncOfficial: 1, NameRule: model.NameRuleExact},
	}
	for _, record := range records {
		require.NoError(t, record.Insert())
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/models/?status=enabled&sync_official=yes&has_price=configured", nil)

	GetAllModelsMeta(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload getModelsMetaResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.Equal(t, int64(1), payload.Data.Total)
	require.Len(t, payload.Data.Items, 1)
	require.Equal(t, "priced-enabled-sync", payload.Data.Items[0].ModelName)
	require.True(t, payload.Data.Items[0].HasPrice)

	disabledRecorder := httptest.NewRecorder()
	disabledCtx, _ := gin.CreateTestContext(disabledRecorder)
	disabledCtx.Request = httptest.NewRequest(http.MethodGet, "/api/models/?status=disabled", nil)

	GetAllModelsMeta(disabledCtx)

	require.Equal(t, http.StatusOK, disabledRecorder.Code)
	payload = getModelsMetaResponse{}
	require.NoError(t, common.Unmarshal(disabledRecorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.Equal(t, int64(1), payload.Data.Total)
	require.Equal(t, "unpriced-disabled-sync", payload.Data.Items[0].ModelName)

	noSyncRecorder := httptest.NewRecorder()
	noSyncCtx, _ := gin.CreateTestContext(noSyncRecorder)
	noSyncCtx.Request = httptest.NewRequest(http.MethodGet, "/api/models/?sync_official=no", nil)

	GetAllModelsMeta(noSyncCtx)

	require.Equal(t, http.StatusOK, noSyncRecorder.Code)
	payload = getModelsMetaResponse{}
	require.NoError(t, common.Unmarshal(noSyncRecorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.Equal(t, int64(1), payload.Data.Total)
	require.Equal(t, "unpriced-enabled-nosync", payload.Data.Items[0].ModelName)
}

func TestGetAllModelsMetaFiltersByTag(t *testing.T) {
	setupModelListControllerTestDB(t)

	records := []*model.Model{
		{ModelName: "tagged-text", Tags: "text,image", Status: 1, SyncOfficial: 1, NameRule: model.NameRuleExact},
		{ModelName: "tagged-context", Tags: "context", Status: 1, SyncOfficial: 1, NameRule: model.NameRuleExact},
		{ModelName: "tagged-empty", Tags: "", Status: 1, SyncOfficial: 1, NameRule: model.NameRuleExact},
	}
	for _, record := range records {
		require.NoError(t, record.Insert())
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/models/?tag=text", nil)

	GetAllModelsMeta(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload getModelsMetaResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.Equal(t, int64(1), payload.Data.Total)
	require.Len(t, payload.Data.Items, 1)
	require.Equal(t, "tagged-text", payload.Data.Items[0].ModelName)

	emptyRecorder := httptest.NewRecorder()
	emptyCtx, _ := gin.CreateTestContext(emptyRecorder)
	emptyCtx.Request = httptest.NewRequest(http.MethodGet, "/api/models/?tag=__empty__", nil)

	GetAllModelsMeta(emptyCtx)

	require.Equal(t, http.StatusOK, emptyRecorder.Code)
	payload = getModelsMetaResponse{}
	require.NoError(t, common.Unmarshal(emptyRecorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.Equal(t, int64(1), payload.Data.Total)
	require.Equal(t, "tagged-empty", payload.Data.Items[0].ModelName)
}

func TestAddMissingModelsCreatesDisabledMetadata(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "default", Model: "missing-add-alpha", ChannelId: 1, Enabled: true},
		{Group: "default", Model: "missing-add-existing", ChannelId: 1, Enabled: true},
	}).Error)
	require.NoError(t, (&model.Model{
		ModelName:    "missing-add-existing",
		Status:       1,
		SyncOfficial: 1,
		NameRule:     model.NameRuleExact,
	}).Insert())

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/models/missing", nil)

	AddMissingModels(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload addMissingModelsResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.Equal(t, 1, payload.Data.CreatedModels)
	require.Equal(t, []string{"missing-add-alpha"}, payload.Data.CreatedList)
	require.Empty(t, payload.Data.SkippedModels)

	var inserted model.Model
	require.NoError(t, db.Where("model_name = ?", "missing-add-alpha").First(&inserted).Error)
	require.Equal(t, 0, inserted.Status)
	require.Equal(t, 1, inserted.SyncOfficial)
	require.Equal(t, model.NameRuleExact, inserted.NameRule)
}

func TestListModelsIncludesTieredBillingModel(t *testing.T) {
	withSelfUseModeDisabled(t)
	withTieredBillingConfig(t, map[string]string{
		"zz-tiered-visible-model":      "tiered_expr",
		"zz-tiered-empty-expr-model":   "tiered_expr",
		"zz-tiered-missing-expr-model": "tiered_expr",
	}, map[string]string{
		"zz-tiered-visible-model":    `tier("base", p * 1 + c * 2)`,
		"zz-tiered-empty-expr-model": "   ",
	})

	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.Create(&model.User{
		Id:       1001,
		Username: "model-list-user",
		Password: "password",
		Group:    "default",
		Status:   common.UserStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "default", Model: "zz-tiered-visible-model", ChannelId: 1, Enabled: true},
		{Group: "default", Model: "zz-tiered-empty-expr-model", ChannelId: 1, Enabled: true},
		{Group: "default", Model: "zz-tiered-missing-expr-model", ChannelId: 1, Enabled: true},
		{Group: "default", Model: "zz-unpriced-model", ChannelId: 1, Enabled: true},
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	ctx.Set("id", 1001)

	ListModels(ctx, constant.ChannelTypeOpenAI)

	ids := decodeListModelsResponse(t, recorder)
	require.Contains(t, ids, "zz-tiered-visible-model")
	require.NotContains(t, ids, "zz-tiered-empty-expr-model")
	require.NotContains(t, ids, "zz-tiered-missing-expr-model")
	require.NotContains(t, ids, "zz-unpriced-model")

	pricingByName := pricingByModelName(model.GetPricing())
	visiblePricing, ok := pricingByName["zz-tiered-visible-model"]
	require.True(t, ok)
	require.Equal(t, "tiered_expr", visiblePricing.BillingMode)
	require.NotEmpty(t, visiblePricing.BillingExpr)

	emptyExprPricing, ok := pricingByName["zz-tiered-empty-expr-model"]
	require.True(t, ok)
	require.Empty(t, emptyExprPricing.BillingMode)
	require.Empty(t, emptyExprPricing.BillingExpr)

	missingExprPricing, ok := pricingByName["zz-tiered-missing-expr-model"]
	require.True(t, ok)
	require.Empty(t, missingExprPricing.BillingMode)
	require.Empty(t, missingExprPricing.BillingExpr)
}

func TestListModelsTokenLimitIncludesTieredBillingModel(t *testing.T) {
	withSelfUseModeDisabled(t)
	withTieredBillingConfig(t, map[string]string{
		"zz-token-tiered-visible-model":      "tiered_expr",
		"zz-token-tiered-empty-expr-model":   "tiered_expr",
		"zz-token-tiered-missing-expr-model": "tiered_expr",
	}, map[string]string{
		"zz-token-tiered-visible-model":    `tier("base", p * 1 + c * 2)`,
		"zz-token-tiered-empty-expr-model": "",
	})
	setupModelListControllerTestDB(t)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenModelLimitEnabled, true)
	common.SetContextKey(ctx, constant.ContextKeyTokenModelLimit, map[string]bool{
		"zz-token-tiered-visible-model":      true,
		"zz-token-tiered-empty-expr-model":   true,
		"zz-token-tiered-missing-expr-model": true,
		"zz-token-unpriced-model":            true,
	})

	ListModels(ctx, constant.ChannelTypeOpenAI)

	ids := decodeListModelsResponse(t, recorder)
	require.Contains(t, ids, "zz-token-tiered-visible-model")
	require.NotContains(t, ids, "zz-token-tiered-empty-expr-model")
	require.NotContains(t, ids, "zz-token-tiered-missing-expr-model")
	require.NotContains(t, ids, "zz-token-unpriced-model")
}
