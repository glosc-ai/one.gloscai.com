package common

import (
	"testing"

	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func TestRelayInfoGetFinalRequestRelayFormatPrefersExplicitFinal(t *testing.T) {
	info := &RelayInfo{
		RelayFormat:             types.RelayFormatOpenAI,
		RequestConversionChain:  []types.RelayFormat{types.RelayFormatOpenAI, types.RelayFormatClaude},
		FinalRequestRelayFormat: types.RelayFormatOpenAIResponses,
	}

	require.Equal(t, types.RelayFormat(types.RelayFormatOpenAIResponses), info.GetFinalRequestRelayFormat())
}

func TestRelayInfoGetFinalRequestRelayFormatFallsBackToConversionChain(t *testing.T) {
	info := &RelayInfo{
		RelayFormat:            types.RelayFormatOpenAI,
		RequestConversionChain: []types.RelayFormat{types.RelayFormatOpenAI, types.RelayFormatClaude},
	}

	require.Equal(t, types.RelayFormat(types.RelayFormatClaude), info.GetFinalRequestRelayFormat())
}

func TestRelayInfoGetFinalRequestRelayFormatFallsBackToRelayFormat(t *testing.T) {
	info := &RelayInfo{
		RelayFormat: types.RelayFormatGemini,
	}

	require.Equal(t, types.RelayFormat(types.RelayFormatGemini), info.GetFinalRequestRelayFormat())
}

func TestRelayInfoGetFinalRequestRelayFormatNilReceiver(t *testing.T) {
	var info *RelayInfo
	require.Equal(t, types.RelayFormat(""), info.GetFinalRequestRelayFormat())
}

func TestTaskSubmitReqUnmarshalDurationNumber(t *testing.T) {
	var req TaskSubmitReq

	require.NoError(t, req.UnmarshalJSON([]byte(`{"prompt":"p","model":"m","duration":5}`)))

	require.Equal(t, "p", req.Prompt)
	require.Equal(t, "m", req.Model)
	require.Equal(t, 5, req.Duration)
}

func TestTaskSubmitReqUnmarshalDurationString(t *testing.T) {
	var req TaskSubmitReq

	require.NoError(t, req.UnmarshalJSON([]byte(`{"prompt":"p","model":"m","duration":"5"}`)))

	require.Equal(t, "p", req.Prompt)
	require.Equal(t, "m", req.Model)
	require.Equal(t, 5, req.Duration)
}

func TestTaskSubmitReqUnmarshalMetadataString(t *testing.T) {
	var req TaskSubmitReq

	require.NoError(t, req.UnmarshalJSON([]byte(`{"prompt":"p","model":"m","metadata":"{\"quality_level\":\"standard\"}"}`)))

	require.Equal(t, map[string]interface{}{"quality_level": "standard"}, req.Metadata)
}
