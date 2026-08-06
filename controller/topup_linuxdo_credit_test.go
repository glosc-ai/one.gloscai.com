package controller

import (
	"math"
	"net/url"
	"testing"

	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLinuxDOCreditSignMatchesProtocolExample(t *testing.T) {
	params := map[string]string{
		"type":         "epay",
		"out_trade_no": "M20250101",
		"pid":          "001",
		"money":        "10",
		"name":         "Test",
		"sign":         "ignored",
		"sign_type":    "MD5",
		"device":       "",
	}

	assert.Equal(t, "ea434aabd7b6df4251cccd48b8018480", linuxDOCreditSign(params, "test-secret"))
}

func TestLinuxDOCreditSignIncludesCallbackURLs(t *testing.T) {
	params := map[string]string{
		"pid":          "001",
		"type":         "epay",
		"out_trade_no": "M1",
		"name":         "Test",
		"money":        "10.00",
		"notify_url":   "https://example.com/notify",
		"return_url":   "https://example.com/return",
	}

	withCallbacks := linuxDOCreditSign(params, "secret")
	delete(params, "notify_url")
	delete(params, "return_url")

	assert.NotEqual(t, linuxDOCreditSign(params, "secret"), withCallbacks)
}

func TestLinuxDOCreditPaymentURLUsesDocumentedEndpoint(t *testing.T) {
	previousGateway := setting.LinuxDOCreditGateway
	t.Cleanup(func() { setting.LinuxDOCreditGateway = previousGateway })
	setting.LinuxDOCreditGateway = "https://credit.linux.do/epay/"

	paymentURL, err := linuxDOCreditPaymentURL()
	require.NoError(t, err)
	parsed, err := url.Parse(paymentURL)
	require.NoError(t, err)
	assert.Equal(t, "https://credit.linux.do/epay/pay/submit.php", parsed.String())
}

func TestLinuxDOCreditPaymentURLRejectsInsecureGateway(t *testing.T) {
	previousGateway := setting.LinuxDOCreditGateway
	t.Cleanup(func() { setting.LinuxDOCreditGateway = previousGateway })
	setting.LinuxDOCreditGateway = "http://credit.linux.do/epay"

	_, err := linuxDOCreditPaymentURL()
	require.Error(t, err)
}

func TestLinuxDOCreditPaymentURLRejectsMalformedGateway(t *testing.T) {
	previousGateway := setting.LinuxDOCreditGateway
	t.Cleanup(func() { setting.LinuxDOCreditGateway = previousGateway })

	for _, gateway := range []string{
		"https://",
		"https://user@credit.linux.do/epay",
		"https://credit.linux.do/epay?redirect=evil",
		"https://credit.linux.do/epay#fragment",
	} {
		setting.LinuxDOCreditGateway = gateway
		_, err := linuxDOCreditPaymentURL()
		require.Error(t, err, gateway)
	}
}

func TestLinuxDOCreditPayMoneyUsesIndependentRatio(t *testing.T) {
	previousRatio := setting.LinuxDOCreditUnitPrice
	t.Cleanup(func() { setting.LinuxDOCreditUnitPrice = previousRatio })
	setting.LinuxDOCreditUnitPrice = 2.5

	assert.InDelta(t, 25, linuxDOCreditPayMoney(10, ""), 0.000001)
}

func TestLinuxDOCreditTopUpAmountBounds(t *testing.T) {
	previousMinimum := setting.LinuxDOCreditMinTopUp
	t.Cleanup(func() { setting.LinuxDOCreditMinTopUp = previousMinimum })
	setting.LinuxDOCreditMinTopUp = 2

	require.Error(t, validateLinuxDOCreditTopUpAmount(1))
	require.NoError(t, validateLinuxDOCreditTopUpAmount(2))
	require.NoError(t, validateLinuxDOCreditTopUpAmount(linuxDOCreditMaxTopUp))
	require.Error(t, validateLinuxDOCreditTopUpAmount(linuxDOCreditMaxTopUp+1))
}

func TestLinuxDOCreditWebhookConfigRejectsInvalidRatio(t *testing.T) {
	previousGateway := setting.LinuxDOCreditGateway
	previousClientID := setting.LinuxDOCreditClientID
	previousSecret := setting.LinuxDOCreditSecret
	previousRatio := setting.LinuxDOCreditUnitPrice
	previousMinimum := setting.LinuxDOCreditMinTopUp
	t.Cleanup(func() {
		setting.LinuxDOCreditGateway = previousGateway
		setting.LinuxDOCreditClientID = previousClientID
		setting.LinuxDOCreditSecret = previousSecret
		setting.LinuxDOCreditUnitPrice = previousRatio
		setting.LinuxDOCreditMinTopUp = previousMinimum
	})

	setting.LinuxDOCreditGateway = setting.LinuxDOCreditDefaultGateway
	setting.LinuxDOCreditClientID = "pid"
	setting.LinuxDOCreditSecret = "secret"
	setting.LinuxDOCreditMinTopUp = 1
	setting.LinuxDOCreditUnitPrice = math.NaN()
	assert.False(t, isLinuxDOCreditWebhookConfigured())

	setting.LinuxDOCreditUnitPrice = 1
	setting.LinuxDOCreditGateway = "http://credit.linux.do/epay"
	assert.False(t, isLinuxDOCreditWebhookConfigured())
}
