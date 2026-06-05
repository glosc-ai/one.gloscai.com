/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

export type ModelCategory = 'text' | 'image' | 'video'

export interface CategorizedModel {
  model_name: string
  tags?: string[]
  categories: ModelCategory[]
}

export interface ModelOption {
  label: string
  value: string
  category?: string
}

export interface GroupOption {
  label: string
  value: string
  ratio?: number
  desc?: string
}

export interface ImageGenerationRequest {
  model: string
  prompt: string
  group?: string
  n?: number
  size?: string
  quality?: string
  response_format?: 'url' | 'b64_json'
  image?: string
  images?: string[]
}

export interface ImageGenerationResult {
  url?: string
  b64_json?: string
  revised_prompt?: string
}

export interface VideoGenerationRequest {
  model: string
  prompt: string
  group?: string
  image?: string
  size?: string
  seconds?: string
  duration?: number
}

export interface VideoTaskStatus {
  taskId: string
  status: 'queued' | 'in_progress' | 'completed' | 'failed'
  progress: number
  url?: string
  errorMessage?: string
  rawStatus?: string
  upstreamStatus?: string
  upstreamModel?: string
  videoId?: string
  action?: string
  quota?: number
}

export interface MediaUploadResult {
  url: string
  key: string
}
