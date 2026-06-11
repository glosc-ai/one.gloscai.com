package model

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

type AdminAPIQuery struct {
	Keyword        string
	StartTimestamp int64
	EndTimestamp   int64
	SortBy         string
	SortOrder      string
	PageInfo       *common.PageInfo
}

func safeSortOrder(order string) string {
	if strings.EqualFold(strings.TrimSpace(order), "asc") {
		return "asc"
	}
	return "desc"
}

func safeSortClause(sortBy string, allowed map[string]string, fallback string, order string) string {
	column, ok := allowed[strings.TrimSpace(sortBy)]
	if !ok {
		column = fallback
	}
	return column + " " + safeSortOrder(order)
}

func ApplyAdminAPIUserFilters(query *gorm.DB, filter AdminAPIQuery) *gorm.DB {
	keyword := strings.TrimSpace(filter.Keyword)
	if keyword != "" {
		pattern := "%" + keyword + "%"
		if id, err := strconv.Atoi(keyword); err == nil {
			query = query.Where(
				"(id = ? OR username LIKE ? OR email LIKE ? OR display_name LIKE ?)",
				id,
				pattern,
				pattern,
				pattern,
			)
		} else {
			query = query.Where(
				"(username LIKE ? OR email LIKE ? OR display_name LIKE ?)",
				pattern,
				pattern,
				pattern,
			)
		}
	}
	if filter.StartTimestamp > 0 {
		query = query.Where("created_at >= ?", filter.StartTimestamp)
	}
	if filter.EndTimestamp > 0 {
		query = query.Where("created_at <= ?", filter.EndTimestamp)
	}
	return query
}

func ListAdminAPIUsers(filter AdminAPIQuery) ([]*User, int64, error) {
	query := ApplyAdminAPIUserFilters(DB.Unscoped().Model(&User{}), filter)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	allowedSorts := map[string]string{
		"id":             "id",
		"created_at":     "created_at",
		"last_login_at":  "last_login_at",
		"quota":          "quota",
		"used_quota":     "used_quota",
		"request_count":  "request_count",
		"username":       "username",
		"display_name":   "display_name",
		"role":           "role",
		"status":         "status",
	}
	var users []*User
	err := query.Omit("password").
		Order(safeSortClause(filter.SortBy, allowedSorts, "id", filter.SortOrder)).
		Limit(filter.PageInfo.GetPageSize()).
		Offset(filter.PageInfo.GetStartIdx()).
		Find(&users).Error
	return users, total, err
}

func ListAdminAPIPaymentLogs(filter TopUpLogFilter, sortBy string, sortOrder string, pageInfo *common.PageInfo) ([]*TopUpLog, int64, error) {
	query := DB.Model(&TopUp{}).Joins("LEFT JOIN users ON users.id = top_ups.user_id")
	var err error
	query, err = applyTopUpLogFilters(query, filter)
	if err != nil {
		return nil, 0, err
	}
	var total int64
	if err = query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	allowedSorts := map[string]string{
		"id":            "top_ups.id",
		"create_time":   "top_ups.create_time",
		"complete_time": "top_ups.complete_time",
		"amount":        "top_ups.amount",
		"money":         "top_ups.money",
		"status":        "top_ups.status",
	}
	var logs []*TopUpLog
	err = query.Select("top_ups.id, top_ups.user_id, COALESCE(users.username, '') AS username, top_ups.amount, top_ups.money, top_ups.trade_no, top_ups.payment_method, top_ups.payment_provider, top_ups.create_time, top_ups.complete_time, top_ups.status").
		Order(safeSortClause(sortBy, allowedSorts, "top_ups.id", sortOrder)).
		Limit(pageInfo.GetPageSize()).
		Offset(pageInfo.GetStartIdx()).
		Find(&logs).Error
	return logs, total, err
}

func ListAdminAPIUsageLogs(logType int, filter AdminAPIQuery, modelName string, username string, tokenName string, channel int, group string, requestId string, upstreamRequestId string) ([]*Log, int64, error) {
	var tx *gorm.DB
	var err error
	if logType == LogTypeUnknown {
		tx = LOG_DB
	} else {
		tx = LOG_DB.Where("logs.type = ?", logType)
	}
	if tx, err = applyExplicitLogTextFilter(tx, "logs.model_name", modelName); err != nil {
		return nil, 0, err
	}
	if tx, err = applyExplicitLogTextFilter(tx, "logs.username", username); err != nil {
		return nil, 0, err
	}
	if tokenName != "" {
		tx = tx.Where("logs.token_name = ?", tokenName)
	}
	if requestId != "" {
		tx = tx.Where("logs.request_id = ?", requestId)
	}
	if upstreamRequestId != "" {
		tx = tx.Where("logs.upstream_request_id = ?", upstreamRequestId)
	}
	if filter.StartTimestamp > 0 {
		tx = tx.Where("logs.created_at >= ?", filter.StartTimestamp)
	}
	if filter.EndTimestamp > 0 {
		tx = tx.Where("logs.created_at <= ?", filter.EndTimestamp)
	}
	if channel != 0 {
		tx = tx.Where("logs.channel_id = ?", channel)
	}
	if group != "" {
		tx = tx.Where("logs."+logGroupCol+" = ?", group)
	}
	var total int64
	if err = tx.Model(&Log{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	allowedSorts := map[string]string{
		"id":                "logs.id",
		"created_at":        "logs.created_at",
		"user_id":           "logs.user_id",
		"username":          "logs.username",
		"model_name":        "logs.model_name",
		"prompt_tokens":     "logs.prompt_tokens",
		"completion_tokens": "logs.completion_tokens",
		"quota":             "logs.quota",
		"use_time":          "logs.use_time",
		"channel":           "logs.channel_id",
		"type":              "logs.type",
	}
	var logs []*Log
	err = tx.Order(safeSortClause(filter.SortBy, allowedSorts, "logs.created_at", filter.SortOrder)+", logs.id desc").
		Limit(filter.PageInfo.GetPageSize()).
		Offset(filter.PageInfo.GetStartIdx()).
		Find(&logs).Error
	return logs, total, err
}

func ListAdminAPIModels(filter ModelsMetaFilter, queryFilter AdminAPIQuery) ([]*Model, int64, error) {
	query := applyModelsMetaFilters(DB.Model(&Model{}), filter)
	if queryFilter.StartTimestamp > 0 {
		query = query.Where("models.created_time >= ?", queryFilter.StartTimestamp)
	}
	if queryFilter.EndTimestamp > 0 {
		query = query.Where("models.created_time <= ?", queryFilter.EndTimestamp)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	allowedSorts := map[string]string{
		"id":            "models.id",
		"model_name":    "models.model_name",
		"created_time":  "models.created_time",
		"updated_time":  "models.updated_time",
		"status":        "models.status",
		"vendor_id":     "models.vendor_id",
		"sync_official": "models.sync_official",
	}
	var models []*Model
	err := query.Order(safeSortClause(queryFilter.SortBy, allowedSorts, "models.id", queryFilter.SortOrder)).
		Limit(queryFilter.PageInfo.GetPageSize()).
		Offset(queryFilter.PageInfo.GetStartIdx()).
		Find(&models).Error
	return models, total, err
}

func ListAdminAPIModelCallLogs(filter ModelCallLogFilter, sortBy string, sortOrder string, pageInfo *common.PageInfo) ([]*ModelCallLog, int64, error) {
	query := applyModelCallLogFilters(LOG_DB.Model(&Log{}), filter)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	allowedSorts := map[string]string{
		"id":                "logs.id",
		"created_at":        "logs.created_at",
		"user_id":           "logs.user_id",
		"model_name":        "logs.model_name",
		"prompt_tokens":     "logs.prompt_tokens",
		"completion_tokens": "logs.completion_tokens",
		"quota":             "logs.quota",
	}
	var logs []*Log
	if err := query.Order(safeSortClause(sortBy, allowedSorts, "logs.id", sortOrder)).
		Limit(pageInfo.GetPageSize()).
		Offset(pageInfo.GetStartIdx()).
		Find(&logs).Error; err != nil {
		return nil, 0, err
	}
	callLogs := make([]*ModelCallLog, 0, len(logs))
	for _, log := range logs {
		status := ModelCallLogStatusSuccess
		errorCode := ""
		errorMessage := ""
		inputText, outputText := getModelCallLogTextDetails(log)
		if log.Type == LogTypeError {
			status = ModelCallLogStatusFailed
			errorCode = getModelCallLogErrorCode(log)
			errorMessage = strings.TrimSpace(log.Content)
		}
		callLogs = append(callLogs, &ModelCallLog{
			Id:               log.Id,
			UserId:           log.UserId,
			Username:         log.Username,
			ModelName:        log.ModelName,
			PromptTokens:     log.PromptTokens,
			CompletionTokens: log.CompletionTokens,
			TotalTokens:      log.PromptTokens + log.CompletionTokens,
			Quota:            log.Quota,
			InputText:        inputText,
			OutputText:       outputText,
			Status:           status,
			ErrorCode:        errorCode,
			ErrorMessage:     errorMessage,
			CreatedAt:        log.CreatedAt,
		})
	}
	return callLogs, total, nil
}
