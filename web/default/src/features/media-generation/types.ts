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

export type ModelCategory =
  | 'text'
  | 'image'
  | 'video'
  | 'audio_stt'
  | 'audio_tts'

export interface CategorizedModel {
  model_name: string
  tags?: string[]
  categories: ModelCategory[]
  channel_type?: number
  channel_type_name?: string
  channel_types_by_group?: Record<string, number>
  channel_type_names_by_group?: Record<string, string>
}

export interface ModelOption {
  label: string
  value: string
  category?: string
  channel_type?: number
  channel_type_name?: string
  channel_types_by_group?: Record<string, number>
  channel_type_names_by_group?: Record<string, string>
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

export interface ImageGenerationHistoryItem {
  id: string
  createdAt: number
  model: string
  group?: string
  prompt: string
  size?: string
  quality?: string
  referenceImage?: string
  results: ImageGenerationResult[]
}

export interface VideoGenerationRequest {
  model: string
  prompt: string
  group?: string
  image?: string
  images?: string[]
  input_reference?: string
  size?: string
  seconds?: string
  duration?: number
  metadata?: Record<string, unknown>
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

export interface VideoGenerationHistoryItem {
  id: string
  createdAt: number
  updatedAt: number
  mode?: string
  model: string
  group?: string
  prompt: string
  image?: string
  firstFrame?: string
  lastFrame?: string
  firstClip?: string
  audioUrl?: string
  negativePrompt?: string
  template?: string
  resolution?: string
  ratio?: string
  legacySize?: string
  size?: string
  seconds?: string
  promptExtend?: boolean
  watermark?: boolean
  audioEnabled?: boolean
  shotType?: string
  seed?: string
  metadata?: Record<string, unknown>
  task: VideoTaskStatus
}

export interface MediaUploadResult {
  url: string
  key: string
}

export interface SpeechToTextRequest {
  model: string
  group?: string
  file: File
  language?: string
  prompt?: string
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt'
  temperature?: number
}

export interface SpeechToTextResult {
  text: string
  language?: string
  duration?: number
  segments?: Array<{
    id?: number
    start?: number
    end?: number
    text: string
  }>
}

export interface SpeechToTextHistoryItem {
  id: string
  createdAt: number
  model: string
  group?: string
  fileName: string
  fileSize: number
  durationSeconds?: number
  result: SpeechToTextResult
}

export interface TextToSpeechRequest {
  model: string
  group?: string
  input: string
  voice: string
  response_format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm'
  speed?: number
}

export interface TextToSpeechResult {
  /** Object URL pointing at the generated audio Blob. */
  url: string
  blob: Blob
  mimeType: string
  byteSize: number
}

export interface TextToSpeechHistoryItem {
  id: string
  createdAt: number
  model: string
  group?: string
  voice: string
  format: string
  speed: number
  input: string
  byteSize: number
}
