package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestRecordModelCallFailureSkipsAutomaticDisableWhenDisabled(t *testing.T) {
	disabledModelFailureMu.Lock()
	originalCounts := disabledModelFailureCounts
	disabledModelFailureCounts = make(map[string]int)
	disabledModelFailureMu.Unlock()
	originalEnabled := common.AutomaticDisableModelEnabled
	common.AutomaticDisableModelEnabled = false
	t.Cleanup(func() {
		common.AutomaticDisableModelEnabled = originalEnabled
		disabledModelFailureMu.Lock()
		disabledModelFailureCounts = originalCounts
		disabledModelFailureMu.Unlock()
	})

	key := disabledModelFailureKey(101, "test-model")
	disabledModelFailureMu.Lock()
	disabledModelFailureCounts[key] = 2
	disabledModelFailureMu.Unlock()

	require.False(t, RecordModelCallFailure(101, "test-channel", "test-model", "upstream error"))

	disabledModelFailureMu.Lock()
	_, exists := disabledModelFailureCounts[key]
	disabledModelFailureMu.Unlock()
	require.False(t, exists)
}
