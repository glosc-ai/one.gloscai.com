package controller

import (
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type addDisabledModelRequest struct {
	ModelName string `json:"model_name"`
	ChannelId int    `json:"channel_id"`
	ExpiresIn int64  `json:"expires_in"`
	Remark    string `json:"remark"`
}

func ListDisabledModels(c *gin.Context) {
	_ = model.CleanExpiredDisabledModels()
	pageInfo := common.GetPageQuery(c)
	var active *bool
	if raw := c.Query("active"); raw != "" {
		if value, err := strconv.ParseBool(raw); err == nil {
			active = &value
		}
	}
	records, total, err := model.ListDisabledModels(pageInfo.GetStartIdx(), pageInfo.GetPageSize(), model.DisabledModelFilter{
		ModelName: c.Query("model_name"),
		Channel:   c.Query("channel"),
		Remark:    c.Query("remark"),
		Active:    active,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"items": records,
		"total": total,
	})
}

func AddDisabledModel(c *gin.Context) {
	var req addDisabledModelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.ModelName == "" || req.ChannelId <= 0 {
		common.ApiErrorMsg(c, "model_name and channel_id are required")
		return
	}
	channel, err := model.GetChannelById(req.ChannelId, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	expiresIn := req.ExpiresIn
	if expiresIn <= 0 {
		expiresIn = int64((10 * time.Minute).Seconds())
	}
	if err := model.AddDisabledModel(req.ModelName, req.ChannelId, channel.Name, time.Duration(expiresIn)*time.Second, req.Remark); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func DeleteDisabledModel(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DeleteDisabledModel(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}
