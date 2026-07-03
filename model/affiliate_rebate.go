package model

import (
	"errors"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type AffiliateRebate struct {
	Id              int     `json:"id"`
	InviterId       int     `json:"inviter_id" gorm:"column:inviter_id;index"`
	InviteeId       int     `json:"invitee_id" gorm:"column:invitee_id;index"`
	TopUpId         int     `json:"top_up_id" gorm:"column:top_up_id;index"`
	TradeNo         string  `json:"trade_no" gorm:"type:varchar(255);column:trade_no;uniqueIndex"`
	RechargeQuota   int     `json:"recharge_quota" gorm:"column:recharge_quota"`
	RechargeAmount  float64 `json:"recharge_amount" gorm:"column:recharge_amount"`
	RebateQuota     int     `json:"rebate_quota" gorm:"column:rebate_quota"`
	RebateRatio     float64 `json:"rebate_ratio" gorm:"column:rebate_ratio"`
	PaymentMethod   string  `json:"payment_method" gorm:"type:varchar(50);column:payment_method"`
	PaymentProvider string  `json:"payment_provider" gorm:"type:varchar(50);column:payment_provider"`
	CreatedAt       int64   `json:"created_at" gorm:"column:created_at;index"`
}

type AffiliateRebateLog struct {
	Id              int     `json:"id"`
	InviterId       int     `json:"inviter_id"`
	InviteeId       int     `json:"invitee_id"`
	InviteeUsername string  `json:"invitee_username"`
	TopUpId         int     `json:"top_up_id"`
	TradeNo         string  `json:"trade_no"`
	RechargeQuota   int     `json:"recharge_quota"`
	RechargeAmount  float64 `json:"recharge_amount"`
	RebateQuota     int     `json:"rebate_quota"`
	RebateRatio     float64 `json:"rebate_ratio"`
	PaymentMethod   string  `json:"payment_method"`
	PaymentProvider string  `json:"payment_provider"`
	CreatedAt       int64   `json:"created_at"`
}

func calculateAffiliateRebateQuota(rechargeQuota int, ratio float64) int {
	if rechargeQuota <= 0 || ratio <= 0 {
		return 0
	}
	return int(decimal.NewFromInt(int64(rechargeQuota)).
		Mul(decimal.NewFromFloat(ratio)).
		Div(decimal.NewFromInt(100)).
		IntPart())
}

func applyAffiliateRebateTx(tx *gorm.DB, topUp *TopUp, rechargeQuota int) (int, error) {
	if topUp == nil || rechargeQuota <= 0 {
		return 0, nil
	}
	if !operation_setting.IsPaymentComplianceConfirmed() {
		return 0, nil
	}

	var invitee User
	if err := tx.Select("id", "inviter_id").Where("id = ?", topUp.UserId).First(&invitee).Error; err != nil {
		return 0, err
	}
	if invitee.InviterId == 0 || invitee.InviterId == invitee.Id {
		return 0, nil
	}

	var existing AffiliateRebate
	err := tx.Select("id").Where("trade_no = ?", topUp.TradeNo).First(&existing).Error
	if err == nil {
		return 0, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, err
	}

	rebateRatio, err := GetEffectiveAffiliateRebateRatioWithTx(tx, invitee.InviterId)
	if err != nil {
		return 0, err
	}
	rebateQuota := calculateAffiliateRebateQuota(rechargeQuota, rebateRatio)
	if rebateQuota <= 0 {
		return 0, nil
	}

	result := tx.Model(&User{}).Where("id = ?", invitee.InviterId).Updates(map[string]interface{}{
		"aff_quota":   gorm.Expr("aff_quota + ?", rebateQuota),
		"aff_history": gorm.Expr("aff_history + ?", rebateQuota),
	})
	if result.Error != nil {
		return 0, result.Error
	}
	if result.RowsAffected == 0 {
		return 0, nil
	}

	createdAt := topUp.CompleteTime
	if createdAt == 0 {
		createdAt = common.GetTimestamp()
	}
	rebate := &AffiliateRebate{
		InviterId:       invitee.InviterId,
		InviteeId:       invitee.Id,
		TopUpId:         topUp.Id,
		TradeNo:         topUp.TradeNo,
		RechargeQuota:   rechargeQuota,
		RechargeAmount:  topUp.Money,
		RebateQuota:     rebateQuota,
		RebateRatio:     rebateRatio,
		PaymentMethod:   topUp.PaymentMethod,
		PaymentProvider: topUp.PaymentProvider,
		CreatedAt:       createdAt,
	}
	if err := tx.Create(rebate).Error; err != nil {
		return 0, err
	}

	return rebateQuota, nil
}

func GetAffiliateRebateLogs(inviterId int, keyword string, pageInfo *common.PageInfo) ([]*AffiliateRebateLog, int64, error) {
	query := DB.Model(&AffiliateRebate{}).
		Select("affiliate_rebates.id, affiliate_rebates.inviter_id, affiliate_rebates.invitee_id, COALESCE(users.username, '') AS invitee_username, affiliate_rebates.top_up_id, affiliate_rebates.trade_no, affiliate_rebates.recharge_quota, affiliate_rebates.recharge_amount, affiliate_rebates.rebate_quota, affiliate_rebates.rebate_ratio, affiliate_rebates.payment_method, affiliate_rebates.payment_provider, affiliate_rebates.created_at").
		Joins("LEFT JOIN users ON users.id = affiliate_rebates.invitee_id").
		Where("affiliate_rebates.inviter_id = ?", inviterId)

	keyword = strings.TrimSpace(keyword)
	if keyword != "" {
		patternKeyword := keyword
		if !strings.Contains(keyword, "%") && len(keyword) >= 2 {
			patternKeyword = "%" + keyword + "%"
		}
		pattern, err := sanitizeLikePattern(patternKeyword)
		if err != nil {
			return nil, 0, err
		}
		if id, parseErr := strconv.Atoi(keyword); parseErr == nil {
			query = query.Where(
				"(affiliate_rebates.trade_no LIKE ? ESCAPE '!' OR users.username LIKE ? ESCAPE '!' OR affiliate_rebates.invitee_id = ? OR affiliate_rebates.id = ?)",
				pattern,
				pattern,
				id,
				id,
			)
		} else {
			query = query.Where(
				"(affiliate_rebates.trade_no LIKE ? ESCAPE '!' OR users.username LIKE ? ESCAPE '!')",
				pattern,
				pattern,
			)
		}
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var logs []*AffiliateRebateLog
	err := query.Order("affiliate_rebates.id desc").
		Limit(pageInfo.GetPageSize()).
		Offset(pageInfo.GetStartIdx()).
		Scan(&logs).Error
	return logs, total, err
}
