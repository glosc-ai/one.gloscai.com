package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

func WeChatAuth(c *gin.Context) {
	handleOAuthProvider(c, "wechat")
}

type wechatBindRequest struct {
	Code  string `json:"code"`
	State string `json:"state"`
}

func WeChatBind(c *gin.Context) {
	session := sessions.Default(c)
	if session.Get("username") == nil {
		common.ApiErrorI18n(c, i18n.MsgAuthNotLoggedIn)
		return
	}

	var req wechatBindRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的请求",
		})
		return
	}

	query := c.Request.URL.Query()
	query.Set("code", req.Code)
	query.Set("state", req.State)
	c.Request.URL.RawQuery = query.Encode()
	handleOAuthProvider(c, "wechat")
}
