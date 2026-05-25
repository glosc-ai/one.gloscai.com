import { z } from 'zod'

export const modelCallLogSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  username: z.string().optional().default(''),
  model_name: z.string().optional().default(''),
  prompt_tokens: z.number().default(0),
  completion_tokens: z.number().default(0),
  total_tokens: z.number().default(0),
  quota: z.number().default(0),
  status: z.string(),
  error_code: z.string().optional().default(''),
  error_message: z.string().optional().default(''),
  created_at: z.number(),
})

export type ModelCallLog = z.infer<typeof modelCallLogSchema>

export interface GetModelCallLogsParams {
  p?: number
  page_size?: number
  keyword?: string
  status?: string
  start_timestamp?: number
  end_timestamp?: number
}

export interface GetModelCallLogsResponse {
  success: boolean
  message?: string
  data?: {
    items: ModelCallLog[]
    total: number
    page: number
    page_size: number
  }
}
