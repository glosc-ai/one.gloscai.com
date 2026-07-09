package volcengine

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
)

const (
	AgentPlanOpenAPIDefaultBaseURL = "https://open.volcengineapi.com"
	AgentPlanOpenAPIServiceName    = "ark_stg"
)

type AgentPlanCredential struct {
	APIKey         string `json:"api_key,omitempty"`
	AccessKey      string `json:"access_key,omitempty"`
	SecretKey      string `json:"secret_key,omitempty"`
	Region         string `json:"region,omitempty"`
	OpenAPIBaseURL string `json:"openapi_base_url,omitempty"`
}

func ParseAgentPlanCredential(raw string) AgentPlanCredential {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return AgentPlanCredential{}
	}

	if strings.HasPrefix(raw, "{") {
		var credential AgentPlanCredential
		if err := common.UnmarshalJsonStr(raw, &credential); err == nil {
			credential.APIKey = strings.TrimSpace(credential.APIKey)
			credential.AccessKey = strings.TrimSpace(credential.AccessKey)
			credential.SecretKey = strings.TrimSpace(credential.SecretKey)
			credential.Region = strings.TrimSpace(credential.Region)
			credential.OpenAPIBaseURL = strings.TrimSpace(credential.OpenAPIBaseURL)
			return credential
		}
	}

	parts := strings.Split(raw, "|")
	for i := range parts {
		parts[i] = strings.TrimSpace(parts[i])
	}
	if len(parts) >= 3 {
		credential := AgentPlanCredential{
			APIKey:    parts[0],
			AccessKey: parts[1],
			SecretKey: parts[2],
		}
		if len(parts) >= 4 {
			credential.Region = parts[3]
		}
		if len(parts) >= 5 {
			credential.OpenAPIBaseURL = parts[4]
		}
		return credential
	}
	if len(parts) == 2 {
		return AgentPlanCredential{
			AccessKey: parts[0],
			SecretKey: parts[1],
		}
	}

	return AgentPlanCredential{APIKey: raw}
}

func AgentPlanAPIKey(raw string) string {
	credential := ParseAgentPlanCredential(raw)
	if credential.APIKey != "" {
		return credential.APIKey
	}
	return strings.TrimSpace(raw)
}

func (c AgentPlanCredential) OpenAPIRegion() string {
	if c.Region != "" {
		return c.Region
	}
	return "cn-beijing"
}

func (c AgentPlanCredential) OpenAPIURL() string {
	if c.OpenAPIBaseURL != "" {
		return strings.TrimRight(c.OpenAPIBaseURL, "/")
	}
	return AgentPlanOpenAPIDefaultBaseURL
}
