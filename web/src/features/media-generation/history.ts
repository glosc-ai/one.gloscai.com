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
import type {
  ImageGenerationHistoryItem,
  VideoGenerationHistoryItem,
} from './types'

const IMAGE_HISTORY_KEY = 'media_generation_image_history'
const VIDEO_HISTORY_KEY = 'media_generation_video_history'
const HISTORY_LIMIT = 30

function canUseStorage() {
  try {
    return typeof window !== 'undefined' && Boolean(window.localStorage)
  } catch {
    return false
  }
}

function readHistory<T>(key: string): T[] {
  if (!canUseStorage()) return []
  try {
    const value = window.localStorage.getItem(key)
    if (!value) return []
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function writeHistory<T>(key: string, items: T[]) {
  if (!canUseStorage()) return
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify(items.slice(0, HISTORY_LIMIT))
    )
  } catch {
    // Storage quota or privacy mode failures should not block generation.
  }
}

function historyId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function createImageHistoryItem(
  item: Omit<ImageGenerationHistoryItem, 'id' | 'createdAt'>
): ImageGenerationHistoryItem {
  return {
    ...item,
    id: historyId('image'),
    createdAt: Date.now(),
  }
}

export function getImageHistory(): ImageGenerationHistoryItem[] {
  return readHistory<ImageGenerationHistoryItem>(IMAGE_HISTORY_KEY)
}

export function saveImageHistoryItem(item: ImageGenerationHistoryItem) {
  const next = [
    item,
    ...getImageHistory().filter((historyItem) => historyItem.id !== item.id),
  ]
  writeHistory(IMAGE_HISTORY_KEY, next)
  return next
}

export function clearImageHistory() {
  writeHistory(IMAGE_HISTORY_KEY, [])
  return []
}

export function createVideoHistoryItem(
  item: Omit<VideoGenerationHistoryItem, 'id' | 'createdAt' | 'updatedAt'>
): VideoGenerationHistoryItem {
  const now = Date.now()
  return {
    ...item,
    id: item.task.taskId || historyId('video'),
    createdAt: now,
    updatedAt: now,
  }
}

export function getVideoHistory(): VideoGenerationHistoryItem[] {
  return readHistory<VideoGenerationHistoryItem>(VIDEO_HISTORY_KEY)
}

export function saveVideoHistoryItem(item: VideoGenerationHistoryItem) {
  const existing = getVideoHistory().find(
    (historyItem) => historyItem.id === item.id
  )
  const nextItem = {
    ...existing,
    ...item,
    createdAt: existing?.createdAt ?? item.createdAt,
    updatedAt: Date.now(),
  }
  const next = [
    nextItem,
    ...getVideoHistory().filter((historyItem) => historyItem.id !== item.id),
  ]
  writeHistory(VIDEO_HISTORY_KEY, next)
  return next
}

export function clearVideoHistory() {
  writeHistory(VIDEO_HISTORY_KEY, [])
  return []
}
