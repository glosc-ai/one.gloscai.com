package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGetModelRequestPlaygroundImageIncludesGroup(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(
		http.MethodPost,
		"/pg/images/generations",
		strings.NewReader(`{"model":"gpt-image-1","group":"vip","prompt":"draw a cat"}`),
	)
	c.Request.Header.Set("Content-Type", "application/json")
	t.Cleanup(func() {
		common.CleanupBodyStorage(c)
	})

	modelRequest, shouldSelectChannel, err := getModelRequest(c)

	require.NoError(t, err)
	require.True(t, shouldSelectChannel)
	require.Equal(t, "gpt-image-1", modelRequest.Model)
	require.Equal(t, "vip", modelRequest.Group)
}

func TestApplyPlaygroundGroupSetsContext(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/pg/images/generations", nil)

	usingGroup, allowed := applyPlaygroundGroup(c, "default", "vip")

	require.True(t, allowed)
	require.Equal(t, "vip", usingGroup)
	require.Equal(t, "vip", common.GetContextKeyString(c, constant.ContextKeyUsingGroup))
	require.Equal(t, "vip", common.GetContextKeyString(c, constant.ContextKeyTokenGroup))
}

