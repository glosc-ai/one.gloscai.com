package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestListDisabledModelsSortsByModelName(t *testing.T) {
	truncateTables(t)

	records := []DisabledModel{
		{ModelName: "zeta-model", ChannelId: 3, ChannelName: "z-channel", CreatedAt: 1, ExpiresAt: 300},
		{ModelName: "alpha-model", ChannelId: 2, ChannelName: "b-channel", CreatedAt: 2, ExpiresAt: 100},
		{ModelName: "alpha-model", ChannelId: 1, ChannelName: "a-channel", CreatedAt: 3, ExpiresAt: 200},
	}
	require.NoError(t, DB.Create(&records).Error)

	got, total, err := ListDisabledModels(0, 20, DisabledModelFilter{})

	require.NoError(t, err)
	require.EqualValues(t, len(records), total)
	require.Equal(t, []DisabledModel{
		records[2],
		records[1],
		records[0],
	}, got)
}
