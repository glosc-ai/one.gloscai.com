export type DisabledModel = {
  id: number
  model_name: string
  channel_id: number
  channel_name: string
  created_at: number
  expires_at: number
  remark: string
}

export type GetDisabledModelsParams = {
  p?: number
  page_size?: number
  model_name?: string
  channel?: string
  remark?: string
  active?: boolean
}

export type GetDisabledModelsResponse = {
  success: boolean
  data: {
    items: DisabledModel[]
    total: number
  }
  message?: string
}
