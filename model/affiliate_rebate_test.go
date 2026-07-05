package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetAffiliateRebateLogsHidesInviteeUsername(t *testing.T) {
	truncateTables(t)

	inviter := &User{
		Id:       301,
		Username: "rebate_privacy_inviter",
		Status:   common.UserStatusEnabled,
	}
	invitee := &User{
		Id:        302,
		Username:  "private_invitee_name",
		Status:    common.UserStatusEnabled,
		InviterId: inviter.Id,
	}
	require.NoError(t, DB.Create(inviter).Error)
	require.NoError(t, DB.Create(invitee).Error)
	require.NoError(t, DB.Create(&AffiliateRebate{
		InviterId:       inviter.Id,
		InviteeId:       invitee.Id,
		TopUpId:         1,
		TradeNo:         "rebate-order-privacy",
		RechargeQuota:   1000,
		RechargeAmount:  1,
		RebateQuota:     50,
		RebateRatio:     5,
		PaymentMethod:   PaymentMethodAlipay,
		PaymentProvider: PaymentProviderEpay,
		CreatedAt:       123456,
	}).Error)

	pageInfo := &common.PageInfo{Page: 1, PageSize: 10}
	logs, total, err := GetAffiliateRebateLogs(inviter.Id, "", pageInfo)
	require.NoError(t, err)
	require.Len(t, logs, 1)
	assert.Equal(t, int64(1), total)
	assert.Equal(t, invitee.Id, logs[0].InviteeId)
	assert.Empty(t, logs[0].InviteeUsername)

	logs, total, err = GetAffiliateRebateLogs(inviter.Id, invitee.Username, pageInfo)
	require.NoError(t, err)
	assert.Empty(t, logs)
	assert.Equal(t, int64(0), total)

	logs, total, err = GetAffiliateRebateLogs(inviter.Id, "302", pageInfo)
	require.NoError(t, err)
	require.Len(t, logs, 1)
	assert.Equal(t, int64(1), total)
	assert.Equal(t, invitee.Id, logs[0].InviteeId)
}
