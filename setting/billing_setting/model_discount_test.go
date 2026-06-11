package billing_setting

import (
	"strconv"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/setting/config"
	"github.com/stretchr/testify/require"
)

func TestGetModelDiscount(t *testing.T) {
	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
	})

	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.model_discounts": `{
			"permanent-model":{"discount":0.8},
			"active-model":{"discount":0.5,"end_time":` + formatUnix(time.Now().Add(time.Hour).Unix()) + `},
			"expired-model":{"discount":0.3,"end_time":` + formatUnix(time.Now().Add(-time.Hour).Unix()) + `}
		}`,
	}))

	discount, ok := GetModelDiscount("permanent-model")
	require.True(t, ok)
	require.Equal(t, 0.8, discount)

	discount, ok = GetModelDiscount("active-model")
	require.True(t, ok)
	require.Equal(t, 0.5, discount)

	discount, ok = GetModelDiscount("expired-model")
	require.False(t, ok)
	require.Equal(t, 1.0, discount)
}

func formatUnix(ts int64) string {
	return strconv.FormatInt(ts, 10)
}
