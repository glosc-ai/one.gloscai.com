import { type TFunction } from 'i18next'
import { type StatusVariant } from '@/components/status-badge'

export const PAYMENT_LOG_STATUS_VALUES = [
  'pending',
  'success',
  'failed',
  'expired',
] as const

export const PAYMENT_METHOD_VALUES = [
  'stripe',
  'creem',
  'waffo',
  'waffo_pancake',
  'alipay',
  'wxpay',
  'alipay_official',
  'wechat_pay_official',
] as const

export const PAYMENT_LOG_STATUSES: Record<
  string,
  { labelKey: string; variant: StatusVariant }
> = {
  pending: { labelKey: 'Pending', variant: 'warning' },
  success: { labelKey: 'Success', variant: 'success' },
  failed: { labelKey: 'Failed', variant: 'danger' },
  expired: { labelKey: 'Expired', variant: 'neutral' },
}

export const PAYMENT_METHODS: Record<string, { labelKey: string }> = {
  stripe: { labelKey: 'Stripe' },
  creem: { labelKey: 'Creem' },
  waffo: { labelKey: 'Waffo' },
  waffo_pancake: { labelKey: 'Waffo Pancake' },
  alipay: { labelKey: 'Alipay' },
  wxpay: { labelKey: 'WeChat Pay' },
  alipay_official: { labelKey: 'Alipay Official' },
  wechat_pay_official: { labelKey: 'WeChat Pay Official' },
}

export function getPaymentLogStatusOptions(t: TFunction) {
  return PAYMENT_LOG_STATUS_VALUES.map((status) => ({
    label: t(PAYMENT_LOG_STATUSES[status].labelKey),
    value: status,
  }))
}

export function getPaymentMethodOptions(t: TFunction) {
  return PAYMENT_METHOD_VALUES.map((method) => ({
    label: t(PAYMENT_METHODS[method].labelKey),
    value: method,
  }))
}

export function getPaymentMethodLabelKey(method: string): string {
  return PAYMENT_METHODS[method]?.labelKey ?? method
}

export function getPaymentLogStatusConfig(status: string): {
  labelKey: string
  variant: StatusVariant
} {
  return (
    PAYMENT_LOG_STATUSES[status] ?? { labelKey: status, variant: 'neutral' }
  )
}
