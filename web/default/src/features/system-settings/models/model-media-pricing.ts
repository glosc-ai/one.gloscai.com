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

export type MediaPricingMode = 'media-image' | 'media-video' | 'media-audio'
export type MediaUnitKind = 'video' | 'image' | 'speech'
export type SpeechBillingSide = 'input' | 'output' | 'both'
export type ExpressionBackedPricingMode = 'tiered_expr' | MediaPricingMode

export type MediaUnitConfig = {
  kind: MediaUnitKind
  videoSecondPrice: number
  videoDefaultSeconds: number
  videoLargeSizeMultiplier: number
  imageBasePrice: number
  imageDefaultCount: number
  imageSmallSizeMultiplier: number
  imageMediumSizeMultiplier: number
  imageLargeSizeMultiplier: number
  speechSecondPrice: number
  speechSide: SpeechBillingSide
}

export const MEDIA_PRICING_MODES: MediaPricingMode[] = [
  'media-image',
  'media-video',
  'media-audio',
]

export const DEFAULT_MEDIA_UNIT_CONFIG: MediaUnitConfig = {
  kind: 'video',
  videoSecondPrice: 0.05,
  videoDefaultSeconds: 1,
  videoLargeSizeMultiplier: 1.666667,
  imageBasePrice: 0.04,
  imageDefaultCount: 1,
  imageSmallSizeMultiplier: 0.4,
  imageMediumSizeMultiplier: 0.45,
  imageLargeSizeMultiplier: 2,
  speechSecondPrice: 0.006,
  speechSide: 'both',
}

const NUMBER_PATTERN = '([-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:e[-+]?\\d+)?)'

export function isMediaPricingMode(mode?: string): mode is MediaPricingMode {
  return MEDIA_PRICING_MODES.includes(mode as MediaPricingMode)
}

export function isExpressionBackedPricingMode(
  mode?: string
): mode is ExpressionBackedPricingMode {
  return mode === 'tiered_expr' || isMediaPricingMode(mode)
}

export function getMediaKindFromPricingMode(
  mode: MediaPricingMode
): MediaUnitKind {
  if (mode === 'media-image') return 'image'
  if (mode === 'media-audio') return 'speech'
  return 'video'
}

export function getMediaPricingModeFromKind(
  kind: MediaUnitKind
): MediaPricingMode {
  if (kind === 'image') return 'media-image'
  if (kind === 'speech') return 'media-audio'
  return 'media-video'
}

export function getMediaModeLabel(mode: MediaPricingMode): string {
  if (mode === 'media-image') return 'Per-image'
  if (mode === 'media-video') return 'Per-video'
  return 'Per-audio'
}

export function createDefaultMediaUnitConfig(
  kindOrMode: MediaUnitKind | MediaPricingMode = 'video'
): MediaUnitConfig {
  const kind = isMediaPricingMode(kindOrMode)
    ? getMediaKindFromPricingMode(kindOrMode)
    : kindOrMode
  return {
    ...DEFAULT_MEDIA_UNIT_CONFIG,
    kind,
  }
}

function exprNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return Number.parseFloat(value.toFixed(12)).toString()
}

export function generateMediaUnitExpr(config: MediaUnitConfig): string {
  if (config.kind === 'video') {
    const secondPrice = exprNumber(config.videoSecondPrice)
    const defaultSeconds = exprNumber(config.videoDefaultSeconds)
    const largeMultiplier = exprNumber(config.videoLargeSizeMultiplier)
    return `tier("video", usd(max(num(param("seconds"), num(param("duration"), ${defaultSeconds})), 0) * ${secondPrice} * (str(param("size")) == "1024x1792" || str(param("size")) == "1792x1024" ? ${largeMultiplier} : 1)))`
  }

  if (config.kind === 'image') {
    const basePrice = exprNumber(config.imageBasePrice)
    const defaultCount = exprNumber(config.imageDefaultCount)
    const smallMultiplier = exprNumber(config.imageSmallSizeMultiplier)
    const mediumMultiplier = exprNumber(config.imageMediumSizeMultiplier)
    const largeMultiplier = exprNumber(config.imageLargeSizeMultiplier)
    return `tier("image", usd(max(num(param("n"), ${defaultCount}), 1) * ${basePrice} * (str(param("size")) == "256x256" ? ${smallMultiplier} : str(param("size")) == "512x512" ? ${mediumMultiplier} : (str(param("size")) == "1024x1792" || str(param("size")) == "1792x1024" ? ${largeMultiplier} : 1))))`
  }

  let audioTokens = 'ai + ao'
  if (config.speechSide === 'input') {
    audioTokens = 'ai'
  } else if (config.speechSide === 'output') {
    audioTokens = 'ao'
  }

  const requestSeconds =
    config.speechSide === 'input'
      ? 'max(num(param("seconds"), num(param("duration"), 0)), 0)'
      : 'max(num(param("seconds"), num(param("duration"), num(param("estimated_duration"), 0))), 0)'
  return `tier("speech", usd((seconds(${audioTokens}) > 0 ? seconds(${audioTokens}) : ${requestSeconds}) * ${exprNumber(config.speechSecondPrice)}))`
}

export function detectMediaPricingMode(
  expr?: string | null
): MediaPricingMode | null {
  if (!expr) return null
  if (/tier\(\s*["']image["']/.test(expr)) return 'media-image'
  if (/tier\(\s*["']video["']/.test(expr)) return 'media-video'
  if (/tier\(\s*["']speech["']/.test(expr)) return 'media-audio'
  return null
}

function readNumber(
  expr: string,
  pattern: string,
  groupIndex = 1
): number | null {
  const match = expr.match(new RegExp(pattern, 'i'))
  if (!match) return null
  const value = Number(match[groupIndex])
  return Number.isFinite(value) ? value : null
}

function readSpeechSide(expr: string): SpeechBillingSide {
  const match = expr.match(/seconds\(([^)]+)\)/i)
  const tokens = match?.[1]?.trim().replace(/\s+/g, ' ')
  if (tokens === 'ai') return 'input'
  if (tokens === 'ao') return 'output'
  return 'both'
}

export function tryParseMediaUnitConfig(
  expr?: string | null
): MediaUnitConfig | null {
  const mode = detectMediaPricingMode(expr)
  if (!mode || !expr) return null

  const defaults = createDefaultMediaUnitConfig(mode)
  const billingExpr = expr.split('|||')[0] ?? expr

  if (mode === 'media-video') {
    return {
      ...defaults,
      videoDefaultSeconds:
        readNumber(
          billingExpr,
          `num\\(param\\("duration"\\),\\s*${NUMBER_PATTERN}\\)`
        ) ?? defaults.videoDefaultSeconds,
      videoSecondPrice:
        readNumber(
          billingExpr,
          `max\\(num\\(param\\("seconds"\\),\\s*num\\(param\\("duration"\\),\\s*${NUMBER_PATTERN}\\)\\),\\s*0\\)\\s*\\*\\s*${NUMBER_PATTERN}`,
          2
        ) ?? defaults.videoSecondPrice,
      videoLargeSizeMultiplier:
        readNumber(
          billingExpr,
          `"1792x1024"\\s*\\?\\s*${NUMBER_PATTERN}\\s*:\\s*1`
        ) ?? defaults.videoLargeSizeMultiplier,
    }
  }

  if (mode === 'media-image') {
    return {
      ...defaults,
      imageDefaultCount:
        readNumber(
          billingExpr,
          `num\\(param\\("n"\\),\\s*${NUMBER_PATTERN}\\)`
        ) ?? defaults.imageDefaultCount,
      imageBasePrice:
        readNumber(
          billingExpr,
          `max\\(num\\(param\\("n"\\),\\s*${NUMBER_PATTERN}\\),\\s*1\\)\\s*\\*\\s*${NUMBER_PATTERN}`,
          2
        ) ?? defaults.imageBasePrice,
      imageSmallSizeMultiplier:
        readNumber(billingExpr, `"256x256"\\s*\\?\\s*${NUMBER_PATTERN}`) ??
        defaults.imageSmallSizeMultiplier,
      imageMediumSizeMultiplier:
        readNumber(billingExpr, `"512x512"\\s*\\?\\s*${NUMBER_PATTERN}`) ??
        defaults.imageMediumSizeMultiplier,
      imageLargeSizeMultiplier:
        readNumber(
          billingExpr,
          `"1792x1024"\\s*\\?\\s*${NUMBER_PATTERN}\\s*:\\s*1`
        ) ?? defaults.imageLargeSizeMultiplier,
    }
  }

  return {
    ...defaults,
    speechSecondPrice:
      readNumber(
        billingExpr,
        `seconds\\([^)]+\\)\\s*\\*\\s*${NUMBER_PATTERN}`
      ) ??
      readNumber(
        billingExpr,
        `\\)\\s*\\*\\s*${NUMBER_PATTERN}\\s*\\)\\s*\\)?\\s*$`
      ) ??
      defaults.speechSecondPrice,
    speechSide: readSpeechSide(billingExpr),
  }
}
