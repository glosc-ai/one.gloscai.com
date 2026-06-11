package controller

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type adminAPIKeyRequest struct {
	Name        string   `json:"name"`
	Scopes      []string `json:"scopes"`
	Status      int      `json:"status"`
	ExpiredAt   int64    `json:"expired_at"`
	Description string   `json:"description"`
}

func GetAdminAPIKeys(c *gin.Context) {
	keys, err := model.ListAdminAPIKeys()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, keys)
}

func CreateAdminAPIKey(c *gin.Context) {
	var req adminAPIKeyRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		common.ApiErrorMsg(c, "name is required")
		return
	}
	scopes := model.NormalizeAdminAPIScopes(req.Scopes)
	if len(scopes) == 0 {
		common.ApiErrorMsg(c, "at least one scope is required")
		return
	}
	key, plainKey, err := model.CreateAdminAPIKey(req.Name, scopes, c.GetInt("id"), req.ExpiredAt, req.Description)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"key":  plainKey,
		"item": key.ToResponse(),
	})
}

func UpdateAdminAPIKey(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req adminAPIKeyRequest
	if err = common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		common.ApiErrorMsg(c, "name is required")
		return
	}
	scopes := model.NormalizeAdminAPIScopes(req.Scopes)
	if len(scopes) == 0 {
		common.ApiErrorMsg(c, "at least one scope is required")
		return
	}
	if req.Status == 0 {
		req.Status = common.UserStatusEnabled
	}
	if err = model.UpdateAdminAPIKey(id, req.Name, scopes, req.Status, req.ExpiredAt, req.Description); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func DeleteAdminAPIKey(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err = model.DeleteAdminAPIKey(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func adminAPIQuery(c *gin.Context) model.AdminAPIQuery {
	pageInfo := common.GetPageQuery(c)
	startTimestamp, _ := strconv.ParseInt(firstNonEmpty(c.Query("start_timestamp"), c.Query("start_time")), 10, 64)
	endTimestamp, _ := strconv.ParseInt(firstNonEmpty(c.Query("end_timestamp"), c.Query("end_time")), 10, 64)
	return model.AdminAPIQuery{
		Keyword:        c.Query("keyword"),
		StartTimestamp: startTimestamp,
		EndTimestamp:   endTimestamp,
		SortBy:         c.Query("sort_by"),
		SortOrder:      c.Query("sort_order"),
		PageInfo:       pageInfo,
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func respondPage(c *gin.Context, pageInfo *common.PageInfo, items any, total int64) {
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func AdminAPIUsers(c *gin.Context) {
	filter := adminAPIQuery(c)
	users, total, err := model.ListAdminAPIUsers(filter)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	respondPage(c, filter.PageInfo, users, total)
}

func AdminAPIPaymentLogs(c *gin.Context) {
	query := adminAPIQuery(c)
	filter := model.TopUpLogFilter{
		Keyword:       query.Keyword,
		PaymentMethod: c.Query("payment_method"),
		Status:        c.Query("status"),
		StartTime:     query.StartTimestamp,
		EndTime:       query.EndTimestamp,
	}
	logs, total, err := model.ListAdminAPIPaymentLogs(filter, query.SortBy, query.SortOrder, query.PageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	respondPage(c, query.PageInfo, logs, total)
}

func AdminAPIUsageLogs(c *gin.Context) {
	query := adminAPIQuery(c)
	logType, _ := strconv.Atoi(c.Query("type"))
	channel, _ := strconv.Atoi(c.Query("channel"))
	logs, total, err := model.ListAdminAPIUsageLogs(
		logType,
		query,
		c.Query("model_name"),
		c.Query("username"),
		c.Query("token_name"),
		channel,
		c.Query("group"),
		c.Query("request_id"),
		c.Query("upstream_request_id"),
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	respondPage(c, query.PageInfo, logs, total)
}

func AdminAPIModels(c *gin.Context) {
	query := adminAPIQuery(c)
	status := parseOptionalInt(c.Query("status"))
	syncOfficial := parseOptionalInt(c.Query("sync_official"))
	models, total, err := model.ListAdminAPIModels(model.ModelsMetaFilter{
		Keyword:      query.Keyword,
		Vendor:       c.Query("vendor"),
		Tag:          c.Query("tag"),
		Status:       status,
		SyncOfficial: syncOfficial,
	}, query)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	enrichModels(models)
	respondPage(c, query.PageInfo, models, total)
}

func parseOptionalInt(raw string) *int {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return nil
	}
	return &value
}

func AdminAPIModelCallLogs(c *gin.Context) {
	query := adminAPIQuery(c)
	logs, total, err := model.ListAdminAPIModelCallLogs(model.ModelCallLogFilter{
		Keyword:        query.Keyword,
		Status:         c.Query("status"),
		StartTimestamp: query.StartTimestamp,
		EndTimestamp:   query.EndTimestamp,
	}, query.SortBy, query.SortOrder, query.PageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	respondPage(c, query.PageInfo, logs, total)
}

func AdminAPIScopes(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": []string{
			model.AdminAPIScopeUsers,
			model.AdminAPIScopePayments,
			model.AdminAPIScopeUsageLogs,
			model.AdminAPIScopeModels,
			model.AdminAPIScopeModelCallLogs,
		},
	})
}
