import { api } from '@/lib/api'
import type { Channel, SearchChannelsResponse } from '@/features/channels/types'
import type {
  GetDisabledModelsParams,
  GetDisabledModelsResponse,
} from './types'

export async function getDisabledModels(
  params: GetDisabledModelsParams
): Promise<GetDisabledModelsResponse> {
  const res = await api.get('/api/disabled_model/', { params })
  return res.data
}

export async function addDisabledModel(data: {
  model_name: string
  channel_id: number
  expires_in?: number
  remark?: string
}): Promise<{ success: boolean; message?: string }> {
  const res = await api.post('/api/disabled_model/', data)
  return res.data
}

export async function deleteDisabledModel(
  id: number
): Promise<{ success: boolean; message?: string }> {
  const res = await api.delete(`/api/disabled_model/${id}`)
  return res.data
}

export async function getEnabledModels(): Promise<{
  success: boolean
  message?: string
  data?: string[]
}> {
  const res = await api.get('/api/channel/models_enabled')
  return res.data
}

export async function getEnabledChannelsByModel(
  modelName: string
): Promise<Channel[]> {
  if (!modelName) return []
  const res = await api.get<SearchChannelsResponse>('/api/channel/search', {
    params: {
      model: modelName,
      status: 'enabled',
      sort_by: 'name',
      sort_order: 'asc',
      page_size: 10000,
    },
  })
  return res.data.data?.items ?? []
}
