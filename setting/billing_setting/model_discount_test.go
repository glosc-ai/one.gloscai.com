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

func TestGetModelDiscountWildcardMatch(t *testing.T) {
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
			"gpt-*":{"discount":0.9},
			"gpt-4o*":{"discount":0.6},
			"gpt-4o-mini":{"discount":0.4},
			"openai/*":{"discount":0.7},
			"claude-?-haiku":{"discount":0.8},
			"expired-*":{"discount":0.2,"end_time":` + formatUnix(time.Now().Add(-time.Hour).Unix()) + `}
		}`,
	}))

	discount, ok := GetModelDiscount("gpt-4o-mini")
	require.True(t, ok)
	require.Equal(t, 0.4, discount)

	discount, ok = GetModelDiscount("gpt-4o-2024-08-06")
	require.True(t, ok)
	require.Equal(t, 0.6, discount)

	discount, ok = GetModelDiscount("gpt-3.5-turbo")
	require.True(t, ok)
	require.Equal(t, 0.9, discount)

	discount, ok = GetModelDiscount("openai/gpt-4o-mini")
	require.True(t, ok)
	require.Equal(t, 0.7, discount)

	discount, ok = GetModelDiscount("claude-3-haiku")
	require.True(t, ok)
	require.Equal(t, 0.8, discount)

	discount, ok = GetModelDiscount("expired-model")
	require.False(t, ok)
	require.Equal(t, 1.0, discount)
}

func formatUnix(ts int64) string {
	return strconv.FormatInt(ts, 10)
}
