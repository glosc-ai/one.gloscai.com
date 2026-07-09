package doubao

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
)

func TestDoubaoTaskAPIBaseURL(t *testing.T) {
	tests := []struct {
		name    string
		baseURL string
		want    string
	}{
		{
			name:    "empty uses doubao default api base",
			baseURL: "",
			want:    constant.ChannelBaseURLs[constant.ChannelTypeDoubaoVideo] + "/api/v3",
		},
		{
			name:    "root base uses normal ark api",
			baseURL: "https://ark.cn-beijing.volces.com/",
			want:    "https://ark.cn-beijing.volces.com/api/v3",
		},
		{
			name:    "normal ark api base is preserved",
			baseURL: "https://ark.cn-beijing.volces.com/api/v3/",
			want:    "https://ark.cn-beijing.volces.com/api/v3",
		},
		{
			name:    "agent plan api base is preserved",
			baseURL: "https://ark.cn-beijing.volces.com/api/plan/v3/",
			want:    "https://ark.cn-beijing.volces.com/api/plan/v3",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.want, doubaoTaskAPIBaseURL(test.baseURL))
		})
	}
}
