import { z } from 'zod'

export const paymentLogSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  username: z.string().optional().default(''),
  amount: z.number(),
  money: z.number(),
  trade_no: z.string(),
  payment_method: z.string(),
  payment_provider: z.string(),
  create_time: z.number(),
  complete_time: z.number(),
  status: z.string(),
})

export type PaymentLog = z.infer<typeof paymentLogSchema>

export interface GetPaymentLogsParams {
  p?: number
  page_size?: number
  keyword?: string
  status?: string
  payment_method?: string
  sort_by?: PaymentLogSortBy
  sort_order?: SortOrder
}

export type SortOrder = 'asc' | 'desc'

export type PaymentLogSortBy =
  | 'id'
  | 'username'
  | 'amount'
  | 'payment_method'
  | 'status'
  | 'create_time'

export interface GetPaymentLogsResponse {
  success: boolean
  message?: string
  data?: {
    items: PaymentLog[]
    total: number
    page: number
    page_size: number
  }
}
