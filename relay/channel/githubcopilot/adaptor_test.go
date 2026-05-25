package githubcopilot

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
)

func TestGetRequestURL(t *testing.T) {
	tests := []struct {
		name string
		info *relaycommon.RelayInfo
		want string
	}{
		{
			name: "chat completions uses default individual base url",
			info: &relaycommon.RelayInfo{
				RelayMode: relayconstant.RelayModeChatCompletions,
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelType: constant.ChannelTypeGitHubCopilot,
				},
			},
			want: "https://api.individual.githubcopilot.com/chat/completions",
		},
		{
			name: "claude model uses anthropic endpoint",
			info: &relaycommon.RelayInfo{
				RelayMode: relayconstant.RelayModeChatCompletions,
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelType:       constant.ChannelTypeGitHubCopilot,
					ChannelBaseUrl:    "https://api.contoso.test",
					UpstreamModelName: "claude-sonnet-4.6",
				},
			},
			want: "https://api.contoso.test/anthropic/v1/messages",
		},
		{
			name: "claude relay format uses anthropic endpoint",
			info: &relaycommon.RelayInfo{
				RelayFormat: types.RelayFormatClaude,
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelType:    constant.ChannelTypeGitHubCopilot,
					ChannelBaseUrl: "https://api.contoso.test",
				},
			},
			want: "https://api.contoso.test/anthropic/v1/messages",
		},
		{
			name: "responses endpoint",
			info: &relaycommon.RelayInfo{
				RelayMode: relayconstant.RelayModeResponses,
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelType:    constant.ChannelTypeGitHubCopilot,
					ChannelBaseUrl: "https://api.contoso.test/",
				},
			},
			want: "https://api.contoso.test/responses",
		},
		{
			name: "embeddings endpoint",
			info: &relaycommon.RelayInfo{
				RelayMode: relayconstant.RelayModeEmbeddings,
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelType:    constant.ChannelTypeGitHubCopilot,
					ChannelBaseUrl: "https://api.contoso.test",
				},
			},
			want: "https://api.contoso.test/embeddings",
		},
	}

	adaptor := &Adaptor{}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := adaptor.GetRequestURL(tt.info)
			if err != nil {
				t.Fatalf("GetRequestURL() error = %v", err)
			}
			if got != tt.want {
				t.Fatalf("GetRequestURL() = %q, want %q", got, tt.want)
			}
		})
	}
}
