package service

import (
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

const disabledModelDuration = 10 * time.Minute

var (
	disabledModelFailureCounts = make(map[string]int)
	disabledModelFailureMu     sync.Mutex
)

func disabledModelFailureKey(channelId int, modelName string) string {
	return fmt.Sprintf("%d:%s", channelId, modelName)
}

func RecordModelCallSuccess(channelId int, modelName string) {
	disabledModelFailureMu.Lock()
	delete(disabledModelFailureCounts, disabledModelFailureKey(channelId, modelName))
	disabledModelFailureMu.Unlock()
}

func RecordModelCallFailure(channelId int, channelName string, modelName string, reason string) bool {
	key := disabledModelFailureKey(channelId, modelName)
	disabledModelFailureMu.Lock()
	count := disabledModelFailureCounts[key] + 1
	if count < 3 {
		disabledModelFailureCounts[key] = count
		disabledModelFailureMu.Unlock()
		return false
	}
	delete(disabledModelFailureCounts, key)
	disabledModelFailureMu.Unlock()

	remark := fmt.Sprintf("连续调用失败 3 次，自动失效 10 分钟：%s", common.LocalLogPreview(reason))
	if err := model.AddDisabledModel(modelName, channelId, channelName, disabledModelDuration, remark); err != nil {
		common.SysError(fmt.Sprintf("failed to add disabled model mark: %s", err.Error()))
		return false
	}
	return true
}
