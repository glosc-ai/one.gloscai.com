package controller

import (
	"io"
	"mime"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

const maxMediaUploadBytes = 10 << 20

func MediaUpload(c *gin.Context) {
	if !service.R2StorageEnabled() {
		common.ApiErrorMsg(c, "R2 storage is not enabled")
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		common.ApiErrorMsg(c, "file is required")
		return
	}
	defer file.Close()

	limited := http.MaxBytesReader(c.Writer, file, maxMediaUploadBytes+1)
	data, err := io.ReadAll(limited)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if len(data) == 0 {
		common.ApiErrorMsg(c, "file is empty")
		return
	}
	if len(data) > maxMediaUploadBytes {
		common.ApiErrorMsg(c, "file is too large")
		return
	}

	contentType := strings.TrimSpace(header.Header.Get("Content-Type"))
	if contentType == "" || contentType == "application/octet-stream" {
		contentType = http.DetectContentType(data)
	}
	mediaType, _, err := mime.ParseMediaType(contentType)
	if err != nil {
		common.ApiErrorMsg(c, "invalid content type")
		return
	}
	if !strings.HasPrefix(mediaType, "image/") {
		common.ApiErrorMsg(c, "only image files are supported")
		return
	}

	objectKey := service.BuildMediaObjectKey(c.GetInt("id"), header.Filename)
	url, err := service.UploadToR2(c.Request.Context(), objectKey, mediaType, data)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"url": url,
		"key": objectKey,
	})
}
