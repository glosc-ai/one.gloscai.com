import { api } from '@/lib/api'
import type { GetModelCallLogsParams, GetModelCallLogsResponse } from './types'

export async function getModelCallLogs(
  params: GetModelCallLogsParams = {}
): Promise<GetModelCallLogsResponse> {
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
  if (params.start_timestamp) {
    searchParams.set('start_timestamp', String(params.start_timestamp))
  }
  if (params.end_timestamp) {
    searchParams.set('end_timestamp', String(params.end_timestamp))
  }

  const res = await api.get(`/api/log/model-calls?${searchParams.toString()}`)
  return res.data
}
