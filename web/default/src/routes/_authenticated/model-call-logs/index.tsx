import z from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import { ModelCallLogs } from '@/features/model-call-logs'
import { MODEL_CALL_LOG_STATUS_VALUES } from '@/features/model-call-logs/constants'

const modelCallLogsSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(10),
  filter: z.string().optional().catch(''),
  status: z.array(z.enum(MODEL_CALL_LOG_STATUS_VALUES)).optional().catch([]),
})

export const Route = createFileRoute('/_authenticated/model-call-logs/')({
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()

    if (!auth.user || auth.user.role < ROLE.ADMIN) {
      throw redirect({
        to: '/403',
      })
    }
  },
  validateSearch: modelCallLogsSearchSchema,
  component: ModelCallLogs,
})
