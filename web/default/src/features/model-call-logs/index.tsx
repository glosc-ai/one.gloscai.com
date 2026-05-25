import { useTranslation } from 'react-i18next'
import { SectionPageLayout } from '@/components/layout'
import { ModelCallLogsTable } from './components/model-call-logs-table'

export function ModelCallLogs() {
  const { t } = useTranslation()

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Model Call Logs')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <ModelCallLogsTable />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
