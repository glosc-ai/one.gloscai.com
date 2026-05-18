package controller

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"net/url"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/require"
)

func TestCreateAlipayQRCodePaymentReturnsPayURL(t *testing.T) {
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	privateKeyPEM := string(pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(privateKey),
	}))

	originalProduct := setting.AlipayProduct
	originalAppId := setting.AlipayAppId
	originalPrivateKey := setting.AlipayPrivateKey
	originalGateway := setting.AlipayGateway
	originalNotifyURL := setting.AlipayNotifyUrl
	originalReturnURL := setting.AlipayReturnUrl
	t.Cleanup(func() {
		setting.AlipayProduct = originalProduct
		setting.AlipayAppId = originalAppId
		setting.AlipayPrivateKey = originalPrivateKey
		setting.AlipayGateway = originalGateway
		setting.AlipayNotifyUrl = originalNotifyURL
		setting.AlipayReturnUrl = originalReturnURL
	})

	setting.AlipayProduct = setting.AlipayProductQRCode
	setting.AlipayAppId = "2021006129694921"
	setting.AlipayPrivateKey = privateKeyPEM
	setting.AlipayGateway = "https://openapi.alipay.com/gateway.do"
	setting.AlipayNotifyUrl = "http://localhost:3000/api/alipay/notify"
	setting.AlipayReturnUrl = "http://localhost:3000/console/topup"

	response, err := createAlipayPayment(nil, "ALI123", "TUC1", 7.3)
	require.NoError(t, err)
	require.NotEmpty(t, response.PayURL)
	require.Empty(t, response.PayForm)
	require.Empty(t, response.QRCode)

	parsedURL, err := url.Parse(response.PayURL)
	require.NoError(t, err)
	query := parsedURL.Query()
	require.Equal(t, "alipay.trade.page.pay", query.Get("method"))
	require.Equal(t, "RSA2", query.Get("sign_type"))
	require.NotEmpty(t, query.Get("sign"))
	require.Contains(t, query.Get("biz_content"), `"qr_pay_mode":"4"`)
	require.Contains(t, query.Get("biz_content"), `"qrcode_width":200`)
}

func TestAlipayPageBizContentSupportsQRCodeMode(t *testing.T) {
	bizContent, err := alipayPageBizContent("FAST_INSTANT_TRADE_PAY", "ALI123", "TUC1", 7.3, map[string]interface{}{
		"qr_pay_mode":  "4",
		"qrcode_width": 200,
	})

	require.NoError(t, err)
	require.Contains(t, bizContent, `"product_code":"FAST_INSTANT_TRADE_PAY"`)
	require.Contains(t, bizContent, `"qr_pay_mode":"4"`)
	require.Contains(t, bizContent, `"qrcode_width":200`)
	require.Contains(t, bizContent, `"total_amount":"7.30"`)
	require.False(t, strings.Contains(bizContent, "alipay.trade.precreate"))
}

func TestAlipayRequestSignContentIncludesSignType(t *testing.T) {
	params := map[string]string{
		"app_id":      "2021006129694921",
		"biz_content": `{"out_trade_no":"ALI307AB838D86CC91FC40A8E7C","subject":"TUC1","total_amount":"7.30"}`,
		"charset":     "utf-8",
		"format":      "JSON",
		"method":      "alipay.trade.precreate",
		"notify_url":  "http://localhost:3000/api/alipay/notify",
		"sign":        "ignored",
		"sign_type":   "RSA2",
		"timestamp":   "2026-05-18 14:50:29",
		"version":     "1.0",
	}

	expected := `app_id=2021006129694921&biz_content={"out_trade_no":"ALI307AB838D86CC91FC40A8E7C","subject":"TUC1","total_amount":"7.30"}&charset=utf-8&format=JSON&method=alipay.trade.precreate&notify_url=http://localhost:3000/api/alipay/notify&sign_type=RSA2&timestamp=2026-05-18 14:50:29&version=1.0`
	require.Equal(t, expected, alipayRequestSignContent(params))
}

func TestAlipayNotifySignContentExcludesSignAndSignType(t *testing.T) {
	params := map[string]string{
		"app_id":       "2021006129694921",
		"out_trade_no": "ALI307AB838D86CC91FC40A8E7C",
		"sign":         "ignored",
		"sign_type":    "RSA2",
		"trade_status": "TRADE_SUCCESS",
	}

	expected := "app_id=2021006129694921&out_trade_no=ALI307AB838D86CC91FC40A8E7C&trade_status=TRADE_SUCCESS"
	require.Equal(t, expected, alipayNotifySignContent(params))
}

func TestAlipayTradeStatusResult(t *testing.T) {
	paid, err := alipayTradeStatusResult("TRADE_SUCCESS", "7.30")
	require.NoError(t, err)
	require.Equal(t, common.TopUpStatusSuccess, paid.Status)
	require.Equal(t, 730, paid.PaidCents)

	pending, err := alipayTradeStatusResult("WAIT_BUYER_PAY", "")
	require.NoError(t, err)
	require.Equal(t, common.TopUpStatusPending, pending.Status)

	failed, err := alipayTradeStatusResult("TRADE_CLOSED", "")
	require.NoError(t, err)
	require.Equal(t, common.TopUpStatusFailed, failed.Status)
}

func TestWeChatPayTradeStateResult(t *testing.T) {
	paid, err := weChatPayTradeStateResult("SUCCESS", 730)
	require.NoError(t, err)
	require.Equal(t, common.TopUpStatusSuccess, paid.Status)
	require.Equal(t, 730, paid.PaidCents)

	pending, err := weChatPayTradeStateResult("NOTPAY", 0)
	require.NoError(t, err)
	require.Equal(t, common.TopUpStatusPending, pending.Status)

	failed, err := weChatPayTradeStateResult("CLOSED", 0)
	require.NoError(t, err)
	require.Equal(t, common.TopUpStatusFailed, failed.Status)
}
