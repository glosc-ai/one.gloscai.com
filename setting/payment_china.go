package setting

import "strings"

const (
	AlipayProductPage   = "page"
	AlipayProductWap    = "wap"
	AlipayProductQRCode = "qrcode"

	WeChatPayTradeTypeNative = "NATIVE"
	WeChatPayTradeTypeH5     = "MWEB"
)

var (
	AlipayEnabled    bool
	AlipayAppId      string
	AlipayPrivateKey string
	AlipayPublicKey  string
	AlipayGateway    string = "https://openapi.alipay.com/gateway.do"
	AlipayProduct    string = AlipayProductPage
	AlipayNotifyUrl  string
	AlipayReturnUrl  string
	AlipayUnitPrice  float64 = 7.3
	AlipayMinTopUp   int     = 1

	WeChatPayEnabled            bool
	WeChatPayAppId              string
	WeChatPayMchId              string
	WeChatPayApiV3Key           string
	WeChatPayMerchantSerialNo   string
	WeChatPayMerchantPrivateKey string
	WeChatPayPlatformPublicKey  string
	WeChatPayPlatformSerialNo   string
	WeChatPayApiBase            string = "https://api.mch.weixin.qq.com"
	WeChatPayTradeType          string = WeChatPayTradeTypeNative
	WeChatPayNotifyUrl          string
	WeChatPayReturnUrl          string
	WeChatPayUnitPrice          float64 = 7.3
	WeChatPayMinTopUp           int     = 1
)

func NormalizeAlipayProduct(product string) string {
	switch strings.ToLower(strings.TrimSpace(product)) {
	case AlipayProductWap:
		return AlipayProductWap
	case AlipayProductQRCode:
		return AlipayProductQRCode
	default:
		return AlipayProductPage
	}
}

func NormalizeWeChatPayTradeType(tradeType string) string {
	switch strings.ToUpper(strings.TrimSpace(tradeType)) {
	case WeChatPayTradeTypeH5, "H5":
		return WeChatPayTradeTypeH5
	default:
		return WeChatPayTradeTypeNative
	}
}
