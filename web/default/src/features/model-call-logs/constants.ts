import { type TFunction } from 'i18next'
import { type StatusVariant } from '@/components/status-badge'

export const MODEL_CALL_LOG_STATUS_VALUES = ['success', 'failed'] as const

export const MODEL_CALL_LOG_STATUSES: Record<
  string,
  { labelKey: string; variant: StatusVariant }
> = {
  success: { labelKey: 'Success', variant: 'success' },
  failed: { labelKey: 'Failed', variant: 'danger' },
}

export function getModelCallLogStatusOptions(t: TFunction) {
  return MODEL_CALL_LOG_STATUS_VALUES.map((status) => ({
    label: t(MODEL_CALL_LOG_STATUSES[status].labelKey),
    value: status,
  }))
}

export function getModelCallLogStatusConfig(status: string): {
  labelKey: string
  variant: StatusVariant
} {
  return (
    MODEL_CALL_LOG_STATUSES[status] ?? {
      labelKey: status,
      variant: 'neutral',
    }
  )
}
