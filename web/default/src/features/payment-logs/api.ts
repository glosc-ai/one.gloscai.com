import { api } from '@/lib/api'
import type { GetPaymentLogsParams, GetPaymentLogsResponse } from './types'

export async function getPaymentLogs(
  params: GetPaymentLogsParams = {}
): Promise<GetPaymentLogsResponse> {
  const searchParams = new URLSearchParams()
  searchParams.set('p', String(params.p ?? 1))
  searchParams.set('page_size', String(params.page_size ?? 20))

  const keyword = params.keyword?.trim()
  if (keyword) {
    searchParams.set('keyword', keyword)
  }
  if (params.status) {
    searchParams.set('status', params.status)
  }
  if (params.payment_method) {
    searchParams.set('payment_method', params.payment_method)
  }

  const res = await api.get(`/api/user/topup?${searchParams.toString()}`)
  return res.data
}
