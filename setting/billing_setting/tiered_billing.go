package billing_setting

import (
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/samber/lo"
)

const (
	BillingModeRatio      = "ratio"
	BillingModeTieredExpr = "tiered_expr"
	BillingModeField      = "billing_mode"
	BillingExprField      = "billing_expr"
)

type ModelDiscount struct {
	Discount float64 `json:"discount"`
	EndTime  int64   `json:"end_time,omitempty"`
}

// BillingSetting is managed by config.GlobalConfig.Register.
// DB keys: billing_setting.billing_mode, billing_setting.billing_expr, billing_setting.model_discounts
type BillingSetting struct {
	BillingMode    map[string]string        `json:"billing_mode"`
	BillingExpr    map[string]string        `json:"billing_expr"`
	ModelDiscounts map[string]ModelDiscount `json:"model_discounts"`
}

var billingSetting = BillingSetting{
	BillingMode:    make(map[string]string),
	BillingExpr:    make(map[string]string),
	ModelDiscounts: make(map[string]ModelDiscount),
}

func init() {
	config.GlobalConfig.Register("billing_setting", &billingSetting)
}

// ---------------------------------------------------------------------------
// Read accessors (hot path, must be fast)
// ---------------------------------------------------------------------------

func GetBillingMode(model string) string {
	if mode, ok := billingSetting.BillingMode[model]; ok {
		return mode
	}
	return BillingModeRatio
}

func GetBillingExpr(model string) (string, bool) {
	expr, ok := billingSetting.BillingExpr[model]
	return expr, ok
}

func GetBillingModeCopy() map[string]string {
	return lo.Assign(billingSetting.BillingMode)
}

func GetBillingExprCopy() map[string]string {
	return lo.Assign(billingSetting.BillingExpr)
}

func GetModelDiscount(model string) (float64, bool) {
	discount, ok := GetModelDiscountInfo(model)
	if !ok {
		return 1, false
	}
	return discount.Discount, true
}

func GetModelDiscountInfo(model string) (ModelDiscount, bool) {
	now := time.Now().Unix()
	if discount, ok := billingSetting.ModelDiscounts[model]; ok {
		if validModelDiscount(discount, now) {
			return discount, true
		}
	}

	bestPattern := ""
	bestSpecificity := -1
	var bestDiscount ModelDiscount
	for pattern, discount := range billingSetting.ModelDiscounts {
		if !strings.ContainsAny(pattern, "*?") {
			continue
		}
		if !validModelDiscount(discount, now) {
			continue
		}
		if !wildcardMatch(pattern, model) {
			continue
		}
		specificity := wildcardSpecificity(pattern)
		if specificity > bestSpecificity ||
			(specificity == bestSpecificity && pattern < bestPattern) {
			bestPattern = pattern
			bestSpecificity = specificity
			bestDiscount = discount
		}
	}
	if bestSpecificity >= 0 {
		return bestDiscount, true
	}
	return ModelDiscount{}, false
}

func GetModelDiscountCopy() map[string]ModelDiscount {
	return lo.Assign(billingSetting.ModelDiscounts)
}

func validModelDiscount(discount ModelDiscount, now int64) bool {
	if discount.Discount <= 0 {
		return false
	}
	if discount.EndTime > 0 && discount.EndTime <= now {
		return false
	}
	return true
}

func wildcardSpecificity(pattern string) int {
	specificity := 0
	for _, char := range pattern {
		if char != '*' && char != '?' {
			specificity++
		}
	}
	return specificity
}

func wildcardMatch(pattern, value string) bool {
	patternRunes := []rune(pattern)
	valueRunes := []rune(value)
	matches := make([]bool, len(valueRunes)+1)
	matches[0] = true

	for _, patternRune := range patternRunes {
		next := make([]bool, len(valueRunes)+1)
		switch patternRune {
		case '*':
			next[0] = matches[0]
			for idx := 1; idx <= len(valueRunes); idx++ {
				next[idx] = matches[idx] || next[idx-1]
			}
		case '?':
			for idx := 1; idx <= len(valueRunes); idx++ {
				next[idx] = matches[idx-1]
			}
		default:
			for idx := 1; idx <= len(valueRunes); idx++ {
				next[idx] = matches[idx-1] && valueRunes[idx-1] == patternRune
			}
		}
		matches = next
	}

	return matches[len(valueRunes)]
}

func GetPricingSyncData(base map[string]any) map[string]any {
	extra := make(map[string]any, 2)
	if modes := GetBillingModeCopy(); len(modes) > 0 {
		extra[BillingModeField] = modes
	}
	if exprs := GetBillingExprCopy(); len(exprs) > 0 {
		extra[BillingExprField] = exprs
	}
	return lo.Assign(base, extra)
}

// ---------------------------------------------------------------------------
// Smoke test (called externally for validation before save)
// ---------------------------------------------------------------------------

func SmokeTestExpr(exprStr string) error {
	return smokeTestExpr(exprStr)
}

func smokeTestExpr(exprStr string) error {
	vectors := []billingexpr.TokenParams{
		{P: 0, C: 0, Len: 0},
		{P: 1000, C: 1000, Len: 1000},
		{P: 100000, C: 100000, Len: 100000},
		{P: 1000000, C: 1000000, Len: 1000000},
	}
	requests := []billingexpr.RequestInput{
		{},
		{
			Headers: map[string]string{
				"anthropic-beta": "fast-mode-2026-02-01",
			},
			Body: []byte(`{"service_tier":"fast","stream_options":{"include_usage":true},"messages":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21]}`),
		},
	}

	for _, v := range vectors {
		for _, request := range requests {
			result, _, err := billingexpr.RunExprWithRequest(exprStr, v, request)
			if err != nil {
				return fmt.Errorf("vector {p=%g, c=%g}: run failed: %w", v.P, v.C, err)
			}
			if result < 0 {
				return fmt.Errorf("vector {p=%g, c=%g}: result %f < 0", v.P, v.C, result)
			}
		}
	}
	return nil
}
