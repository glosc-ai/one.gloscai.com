import { useTranslation } from 'react-i18next'
import { SectionPageLayout } from '@/components/layout'
import { PaymentLogsTable } from './components/payment-logs-table'

export function PaymentLogs() {
  const { t } = useTranslation()

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Payment Logs')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <PaymentLogsTable />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
