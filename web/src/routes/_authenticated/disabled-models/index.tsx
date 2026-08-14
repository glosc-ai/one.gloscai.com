import z from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { DisabledModels } from '@/features/disabled-models'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

const disabledModelsSearchSchema = z.object({
  page: z.number().optional().catch(1),
})

export const Route = createFileRoute('/_authenticated/disabled-models/')({
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()

    if (!auth.user || auth.user.role < ROLE.ADMIN) {
      throw redirect({
        to: '/403',
      })
    }
  },
  validateSearch: disabledModelsSearchSchema,
  component: DisabledModels,
})
