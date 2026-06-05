package controller

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"mime"
	"net/http"
	"path"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/aws/aws-sdk-go-v2/aws/signer/v4"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const maxMediaUploadBytes = 10 << 20

var objectPrefixCleaner = regexp.MustCompile(`[^a-zA-Z0-9/_-]+`)

func getOptionString(key string) string {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	return strings.TrimSpace(common.OptionMap[key])
}

func getOptionBool(key string) bool {
	value := strings.ToLower(getOptionString(key))
	return value == "true" || value == "1" || value == "yes"
}

func sanitizeR2ObjectPrefix(prefix string) string {
	prefix = strings.Trim(prefix, "/")
	prefix = objectPrefixCleaner.ReplaceAllString(prefix, "-")
	prefix = path.Clean(prefix)
	if prefix == "." {
		return ""
	}
	return strings.Trim(prefix, "/")
}

func buildMediaObjectKey(userID int, originalName string) string {
	ext := strings.ToLower(filepath.Ext(originalName))
	if ext == "" {
		ext = ".png"
	}
	prefix := sanitizeR2ObjectPrefix(getOptionString("R2ObjectPrefix"))
	parts := []string{
		fmt.Sprintf("user-%d", userID),
		time.Now().UTC().Format("20060102"),
		uuid.NewString() + ext,
	}
	if prefix != "" {
		parts = append([]string{prefix}, parts...)
	}
	return path.Join(parts...)
}

func publicMediaURL(baseURL, objectKey string) string {
	return strings.TrimRight(baseURL, "/") + "/" + strings.TrimLeft(objectKey, "/")
}

func uploadToR2(ctx context.Context, objectKey string, contentType string, data []byte) (string, error) {
	accountID := getOptionString("R2AccountID")
	bucket := getOptionString("R2Bucket")
	accessKey := getOptionString("R2AccessKey")
	secretKey := getOptionString("R2SecretKey")
	publicBaseURL := getOptionString("R2PublicBaseURL")
	if accountID == "" || bucket == "" || accessKey == "" || secretKey == "" || publicBaseURL == "" {
		return "", fmt.Errorf("R2 storage is not fully configured")
	}

	endpoint := fmt.Sprintf("https://%s.r2.cloudflarestorage.com", accountID)
	escapedKey := strings.TrimLeft(path.Clean(objectKey), "/")
	requestURL := fmt.Sprintf("%s/%s/%s", strings.TrimRight(endpoint, "/"), bucket, escapedKey)
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, requestURL, bytes.NewReader(data))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("Content-Length", strconv.Itoa(len(data)))

	hash := sha256.Sum256(data)
	payloadHash := hex.EncodeToString(hash[:])
	req.Header.Set("X-Amz-Content-Sha256", payloadHash)
	provider := credentials.NewStaticCredentialsProvider(accessKey, secretKey, "")
	creds, err := provider.Retrieve(ctx)
	if err != nil {
		return "", err
	}
	signer := v4.NewSigner()
	if err := signer.SignHTTP(ctx, creds, req, payloadHash, "s3", "auto", time.Now().UTC()); err != nil {
		return "", err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return "", fmt.Errorf("R2 upload failed: %s %s", resp.Status, strings.TrimSpace(string(body)))
	}
	return publicMediaURL(publicBaseURL, escapedKey), nil
}

func MediaUpload(c *gin.Context) {
	if !getOptionBool("R2StorageEnabled") {
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

	objectKey := buildMediaObjectKey(c.GetInt("id"), header.Filename)
	url, err := uploadToR2(c.Request.Context(), objectKey, mediaType, data)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"url": url,
		"key": objectKey,
	})
}
