package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

const (
	AdminAPIScopeUsers          = "users"
	AdminAPIScopePayments       = "payments"
	AdminAPIScopeUsageLogs      = "usage_logs"
	AdminAPIScopeModels         = "models"
	AdminAPIScopeModelCallLogs  = "model_call_logs"
	AdminAPIKeyPrefix           = "nak-"
	adminAPIKeyRandomPartLength = 48
)

var ErrAdminAPIKeyInvalid = errors.New("admin api key invalid")

type AdminAPIKey struct {
	Id          int    `json:"id"`
	Name        string `json:"name" gorm:"type:varchar(100);not null"`
	KeyHash     string `json:"-" gorm:"type:char(40);uniqueIndex;not null"`
	KeyPrefix   string `json:"key_prefix" gorm:"type:varchar(16);index"`
	Scopes      string `json:"-" gorm:"type:text"`
	Status      int    `json:"status" gorm:"default:1;index"`
	CreatedBy   int    `json:"created_by" gorm:"index"`
	CreatedAt   int64  `json:"created_at" gorm:"autoCreateTime;column:created_at"`
	UpdatedAt   int64  `json:"updated_at" gorm:"autoUpdateTime;column:updated_at"`
	LastUsedAt  int64  `json:"last_used_at" gorm:"default:0"`
	ExpiredAt   int64  `json:"expired_at" gorm:"default:0;index"`
	Description string `json:"description,omitempty" gorm:"type:varchar(255)"`
}

type AdminAPIKeyResponse struct {
	AdminAPIKey
	ScopeList []string `json:"scope_list"`
}

func NormalizeAdminAPIScopes(scopes []string) []string {
	allowed := map[string]struct{}{
		AdminAPIScopeUsers:         {},
		AdminAPIScopePayments:      {},
		AdminAPIScopeUsageLogs:     {},
		AdminAPIScopeModels:        {},
		AdminAPIScopeModelCallLogs: {},
	}
	seen := make(map[string]struct{}, len(scopes))
	result := make([]string, 0, len(scopes))
	for _, scope := range scopes {
		scope = strings.TrimSpace(scope)
		if _, ok := allowed[scope]; !ok {
			continue
		}
		if _, ok := seen[scope]; ok {
			continue
		}
		seen[scope] = struct{}{}
		result = append(result, scope)
	}
	return result
}

func adminAPIKeyHash(key string) string {
	return common.Sha1([]byte(strings.TrimSpace(key)))
}

func marshalAdminAPIScopes(scopes []string) (string, error) {
	data, err := common.Marshal(NormalizeAdminAPIScopes(scopes))
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (key *AdminAPIKey) ScopeList() []string {
	var scopes []string
	if strings.TrimSpace(key.Scopes) == "" {
		return scopes
	}
	if err := common.UnmarshalJsonStr(key.Scopes, &scopes); err != nil {
		return []string{}
	}
	return NormalizeAdminAPIScopes(scopes)
}

func (key *AdminAPIKey) ToResponse() AdminAPIKeyResponse {
	return AdminAPIKeyResponse{
		AdminAPIKey: *key,
		ScopeList:  key.ScopeList(),
	}
}

func GenerateAdminAPIKey() (string, error) {
	random, err := common.GenerateRandomCharsKey(adminAPIKeyRandomPartLength)
	if err != nil {
		return "", err
	}
	return AdminAPIKeyPrefix + random, nil
}

func CreateAdminAPIKey(name string, scopes []string, createdBy int, expiredAt int64, description string) (*AdminAPIKey, string, error) {
	plainKey, err := GenerateAdminAPIKey()
	if err != nil {
		return nil, "", err
	}
	scopeJSON, err := marshalAdminAPIScopes(scopes)
	if err != nil {
		return nil, "", err
	}
	keyPrefix := plainKey
	if len(keyPrefix) > 12 {
		keyPrefix = keyPrefix[:12]
	}
	apiKey := &AdminAPIKey{
		Name:        strings.TrimSpace(name),
		KeyHash:     adminAPIKeyHash(plainKey),
		KeyPrefix:   keyPrefix,
		Scopes:      scopeJSON,
		Status:      common.UserStatusEnabled,
		CreatedBy:   createdBy,
		ExpiredAt:   expiredAt,
		Description: strings.TrimSpace(description),
	}
	if err = DB.Create(apiKey).Error; err != nil {
		return nil, "", err
	}
	return apiKey, plainKey, nil
}

func ListAdminAPIKeys() ([]AdminAPIKeyResponse, error) {
	var keys []*AdminAPIKey
	if err := DB.Order("id desc").Find(&keys).Error; err != nil {
		return nil, err
	}
	responses := make([]AdminAPIKeyResponse, 0, len(keys))
	for _, key := range keys {
		responses = append(responses, key.ToResponse())
	}
	return responses, nil
}

func UpdateAdminAPIKey(id int, name string, scopes []string, status int, expiredAt int64, description string) error {
	scopeJSON, err := marshalAdminAPIScopes(scopes)
	if err != nil {
		return err
	}
	return DB.Model(&AdminAPIKey{}).Where("id = ?", id).Updates(map[string]interface{}{
		"name":        strings.TrimSpace(name),
		"scopes":      scopeJSON,
		"status":      status,
		"expired_at":  expiredAt,
		"description": strings.TrimSpace(description),
	}).Error
}

func DeleteAdminAPIKey(id int) error {
	return DB.Delete(&AdminAPIKey{}, id).Error
}

func ValidateAdminAPIKey(plainKey string, requiredScope string) (*AdminAPIKey, error) {
	var key AdminAPIKey
	if strings.TrimSpace(plainKey) == "" {
		return nil, ErrAdminAPIKeyInvalid
	}
	if err := DB.Where("key_hash = ?", adminAPIKeyHash(plainKey)).First(&key).Error; err != nil {
		return nil, err
	}
	now := common.GetTimestamp()
	if key.Status != common.UserStatusEnabled || (key.ExpiredAt > 0 && key.ExpiredAt < now) {
		return nil, ErrAdminAPIKeyInvalid
	}
	if requiredScope != "" {
		hasScope := false
		for _, scope := range key.ScopeList() {
			if scope == requiredScope {
				hasScope = true
				break
			}
		}
		if !hasScope {
			return nil, ErrAdminAPIKeyInvalid
		}
	}
	_ = DB.Model(&AdminAPIKey{}).Where("id = ?", key.Id).Update("last_used_at", now).Error
	return &key, nil
}
