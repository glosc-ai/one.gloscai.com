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
import { api } from '@/lib/api'
import type {
  CategorizedModel,
  GroupOption,
  ImageGenerationRequest,
  ImageGenerationResult,
  MediaUploadResult,
  SpeechToTextRequest,
  SpeechToTextResult,
  TextToSpeechRequest,
  TextToSpeechResult,
  VideoGenerationRequest,
  VideoTaskStatus,
} from './types'

export const MEDIA_API_ENDPOINTS = {
  CATEGORIZED_MODELS: '/api/user/models/categorized',
  USER_GROUPS: '/api/user/self/groups',
  IMAGE_GENERATIONS: '/pg/images/generations',
  VIDEO_GENERATIONS: '/pg/video/generations',
  AUDIO_SPEECH: '/pg/audio/speech',
  AUDIO_TRANSCRIPTIONS: '/pg/audio/transcriptions',
  UPLOAD: '/api/user/media/upload',
} as const

/**
 * Fetch the models available to the current user together with their
 * usage-scenario categories (text/image/video) and tags.
 */
export async function getCategorizedModels(): Promise<CategorizedModel[]> {
  const res = await api.get(MEDIA_API_ENDPOINTS.CATEGORIZED_MODELS)
  const { data } = res
  if (!data?.success || !Array.isArray(data.data)) {
    return []
  }
  return data.data as CategorizedModel[]
}

/**
 * Fetch user groups with descriptions and ratios.
 */
export async function getUserGroups(): Promise<GroupOption[]> {
  const res = await api.get(MEDIA_API_ENDPOINTS.USER_GROUPS)
  const { data } = res
  if (!data?.success || !data.data) {
    return []
  }
  const groupData = data.data as Record<string, { desc: string; ratio: number }>
  return Object.entries(groupData).map(([group, info]) => ({
    label: group,
    value: group,
    ratio: info.ratio,
    desc: info.desc,
  }))
}

/**
 * Submit an image generation request through the dashboard playground proxy.
 */
export async function generateImage(
  payload: ImageGenerationRequest
): Promise<ImageGenerationResult[]> {
  const res = await api.post(MEDIA_API_ENDPOINTS.IMAGE_GENERATIONS, payload, {
    skipErrorHandler: true,
  } as Record<string, unknown>)
  const data = res.data
  if (!Array.isArray(data?.data)) {
    return []
  }
  return data.data as ImageGenerationResult[]
}

export async function uploadReferenceImage(
  file: File
): Promise<MediaUploadResult> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await api.post(MEDIA_API_ENDPOINTS.UPLOAD, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    skipErrorHandler: true,
  })
  const data = res.data
  if (!data?.success || !data.data?.url) {
    throw new Error(data?.message || 'Failed to upload image')
  }
  return data.data as MediaUploadResult
}

interface RawVideoTask {
  code?: string
  message?: string
  id?: string | number
  task_id?: string
  status?: string
  fail_reason?: string
  action?: string
  quota?: number
  result_url?: string
  url?: string
  output?: string
  progress?: number | string
  properties?: {
    upstream_model_name?: string
    origin_model_name?: string
    input?: string
  }
  data?: RawVideoTaskData | RawVideoTask
}

interface RawVideoTaskData {
  id?: string
  task_id?: string
  status?: string
  progress?: number | string
  error?: { message?: string } | string
  metadata?: { url?: string }
  url?: string
  video_id?: string
  model?: string
  output?: string
  result_url?: string
  data?: { task_id?: string; url?: string }
}

function unwrapVideoTask(raw: RawVideoTask): RawVideoTask {
  if (
    raw &&
    raw.data &&
    typeof raw.data === 'object' &&
    'task_id' in raw.data
  ) {
    return raw.data as RawVideoTask
  }
  return raw
}

function parseProgress(value: number | string | undefined): number {
  if (typeof value === 'number') return Math.max(0, Math.min(100, value))
  if (!value) return 0
  const parsed = Number.parseInt(String(value).replace('%', ''), 10)
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 0
}

function normalizeStatus(
  status: string | undefined
): VideoTaskStatus['status'] {
  const rawStatus = (status || '').toLowerCase()
  if (['completed', 'success', 'succeeded', 'succeed'].includes(rawStatus)) {
    return 'completed'
  }
  if (['failed', 'failure', 'error', 'fail'].includes(rawStatus)) {
    return 'failed'
  }
  if (['queued', 'submitted', 'not_start', 'pending'].includes(rawStatus)) {
    return 'queued'
  }
  return 'in_progress'
}

function normalizeVideoTask(raw: RawVideoTask): VideoTaskStatus {
  const task = unwrapVideoTask(raw)
  const taskData =
    task.data && typeof task.data === 'object'
      ? (task.data as RawVideoTaskData)
      : undefined
  const taskId =
    String(
      task.task_id || taskData?.task_id || task.id || taskData?.id || ''
    ) || ''
  const upstreamStatus = taskData?.status
  const rawStatus = task.status || upstreamStatus
  const status = normalizeStatus(rawStatus)
  const url =
    task.result_url ||
    task.url ||
    taskData?.metadata?.url ||
    taskData?.url ||
    taskData?.result_url ||
    taskData?.output ||
    taskData?.data?.url
  const progress = parseProgress(task.progress ?? taskData?.progress)
  const errorMessage =
    task.fail_reason ||
    (typeof taskData?.error === 'string'
      ? taskData.error
      : taskData?.error?.message)
  return {
    taskId,
    status,
    progress,
    url,
    errorMessage,
    rawStatus,
    upstreamStatus,
    upstreamModel:
      task.properties?.upstream_model_name ||
      task.properties?.origin_model_name ||
      taskData?.model,
    videoId: taskData?.video_id,
    action: task.action,
    quota: task.quota,
  }
}

/**
 * Submit a video generation request through the dashboard playground proxy.
 * Returns the created task identifier used for subsequent polling.
 */
export async function submitVideoGeneration(
  payload: VideoGenerationRequest
): Promise<VideoTaskStatus> {
  const res = await api.post(MEDIA_API_ENDPOINTS.VIDEO_GENERATIONS, payload, {
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return normalizeVideoTask(res.data ?? {})
}

/**
 * Poll the status of a previously submitted video generation task.
 */
export async function fetchVideoTask(taskId: string): Promise<VideoTaskStatus> {
  const res = await api.get(
    `${MEDIA_API_ENDPOINTS.VIDEO_GENERATIONS}/${encodeURIComponent(taskId)}`,
    { disableDuplicate: true, skipErrorHandler: true } as Record<
      string,
      unknown
    >
  )
  return normalizeVideoTask(res.data ?? {})
}

/**
 * Submit a speech-to-text (STT) transcription request through the dashboard
 * playground proxy. The audio file is sent as multipart/form-data.
 */
export async function transcribeSpeech(
  payload: SpeechToTextRequest
): Promise<SpeechToTextResult> {
  const formData = new FormData()
  formData.append('file', payload.file)
  formData.append('model', payload.model)
  if (payload.language) formData.append('language', payload.language)
  if (payload.prompt) formData.append('prompt', payload.prompt)
  formData.append('response_format', payload.response_format ?? 'verbose_json')
  if (typeof payload.temperature === 'number') {
    formData.append('temperature', String(payload.temperature))
  }
  const res = await api.post(
    MEDIA_API_ENDPOINTS.AUDIO_TRANSCRIPTIONS,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      skipErrorHandler: true,
    } as Record<string, unknown>
  )
  const data = res.data
  if (typeof data === 'string') {
    return { text: data }
  }
  if (data && typeof data === 'object' && typeof data.text === 'string') {
    return {
      text: data.text,
      language: data.language,
      duration: data.duration,
      segments: Array.isArray(data.segments) ? data.segments : undefined,
    }
  }
  throw new Error('Unexpected transcription response')
}

/**
 * Synthesize speech audio from text via the dashboard playground proxy. The
 * upstream returns raw audio bytes which are wrapped in a Blob URL for
 * playback in the browser.
 */
export async function synthesizeSpeech(
  payload: TextToSpeechRequest
): Promise<TextToSpeechResult> {
  const body: Record<string, unknown> = {
    model: payload.model,
    input: payload.input,
    voice: payload.voice,
    response_format: payload.response_format ?? 'mp3',
  }
  if (typeof payload.speed === 'number') {
    body.speed = payload.speed
  }
  const res = await api.post(MEDIA_API_ENDPOINTS.AUDIO_SPEECH, body, {
    responseType: 'blob',
    skipErrorHandler: true,
  } as Record<string, unknown>)
  const raw = res.data as Blob
  if (!(raw instanceof Blob)) {
    throw new Error('Unexpected speech response')
  }
  // Some proxies return JSON errors with 200 status; sniff the blob.
  if (raw.type && raw.type.startsWith('application/json')) {
    const text = await raw.text()
    try {
      const err = JSON.parse(text)
      throw new Error(err?.error?.message || err?.message || 'TTS failed')
    } catch {
      throw new Error(text || 'TTS failed')
    }
  }
  const format = (payload.response_format ?? 'mp3').toLowerCase()
  const mimeMap: Record<string, string> = {
    mp3: 'audio/mpeg',
    opus: 'audio/ogg',
    aac: 'audio/aac',
    flac: 'audio/flac',
    wav: 'audio/wav',
    pcm: 'audio/pcm',
  }
  const mimeType = raw.type || mimeMap[format] || 'audio/mpeg'
  const blob = raw.type ? raw : new Blob([raw], { type: mimeType })
  const url = URL.createObjectURL(blob)
  return {
    url,
    blob,
    mimeType,
    byteSize: blob.size,
  }
}
