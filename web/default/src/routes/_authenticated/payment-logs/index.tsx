import z from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import { PaymentLogs } from '@/features/payment-logs'
import {
  PAYMENT_LOG_STATUS_VALUES,
  PAYMENT_METHOD_VALUES,
} from '@/features/payment-logs/constants'

const paymentLogsSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(10),
  filter: z.string().optional().catch(''),
  status: z.array(z.enum(PAYMENT_LOG_STATUS_VALUES)).optional().catch([]),
  payment_method: z.array(z.enum(PAYMENT_METHOD_VALUES)).optional().catch([]),
})

export const Route = createFileRoute('/_authenticated/payment-logs/')({
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()

    if (!auth.user || auth.user.role < ROLE.ADMIN) {
      throw redirect({
        to: '/403',
      })
    }
  },
  validateSearch: paymentLogsSearchSchema,
  component: PaymentLogs,
})
