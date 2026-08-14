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
import type { ModelCapability, Modality, PricingModel } from '../types'

type ModelMetadata = {
  context_length: number
  input_modalities: Modality[]
  output_modalities: Modality[]
  capabilities: ModelCapability[]
}

type ApiInfo = {
  vendor_label: string
  vendor_icon?: string
}

const TOKEN_FORMAT = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
})

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

function inferContextLength(modelName: string): number {
  const name = modelName.toLowerCase()

  if (/gemini/.test(name)) return 1_000_000
  if (/claude/.test(name)) return 200_000
  if (/gpt-4\.1|gpt-4o|gpt-5|^o[134]/.test(name)) return 128_000
  if (/deepseek|qwen|qwq|qvq|kimi|llama|mistral|mixtral/.test(name)) {
    return 128_000
  }
  if (/embed/.test(name)) return 8_192

  return 0
}

function inferVendorLabel(modelName: string): string {
  const name = modelName.toLowerCase()

  if (/claude/.test(name)) return 'Anthropic'
  if (/gemini|imagen|veo/.test(name)) return 'Google'
  if (/deepseek/.test(name)) return 'DeepSeek'
  if (/qwen|qwq|qvq/.test(name)) return 'Alibaba Cloud'
  if (/kimi/.test(name)) return 'Moonshot AI'
  if (/grok/.test(name)) return 'xAI'
  if (/llama/.test(name)) return 'Meta'
  if (/mistral|mixtral/.test(name)) return 'Mistral AI'
  if (/dall.?e|gpt|^o[134]|sora|whisper|tts|embed/.test(name)) return 'OpenAI'

  return 'AI Provider'
}

export function formatTokenCount(tokens: number): string {
  if (!Number.isFinite(tokens) || tokens <= 0) return 'N/A'
  if (tokens >= 1_000_000) {
    return `${TOKEN_FORMAT.format(tokens / 1_000_000)}M`
  }
  if (tokens >= 1_000) {
    return `${TOKEN_FORMAT.format(tokens / 1_000)}K`
  }
  return TOKEN_FORMAT.format(tokens)
}

export function inferModelMetadata(model: PricingModel): ModelMetadata {
  const name = model.model_name.toLowerCase()
  const inputModalities = model.input_modalities?.length
    ? [...model.input_modalities]
    : (['text'] satisfies Modality[])
  const outputModalities = model.output_modalities?.length
    ? [...model.output_modalities]
    : (['text'] satisfies Modality[])
  const capabilities = model.capabilities?.length ? [...model.capabilities] : []

  if (/embed/.test(name)) {
    capabilities.push('embeddings')
  }
  if (/^o[134]|reasoning|reasoner|thinking|deepseek-r|qwq/.test(name)) {
    capabilities.push('reasoning')
  }
  if (/vision|gpt-4o|gpt-4\.1|claude|gemini|qwen.*vl/.test(name)) {
    inputModalities.push('image')
    capabilities.push('vision')
  }
  if (/dall.?e|gpt-image|imagen|stable|sdxl|flux|midjourney/.test(name)) {
    outputModalities.push('image')
  }
  if (/sora|veo|wan|kling|runway|video/.test(name)) {
    outputModalities.push('video')
  }
  if (/whisper|audio|tts/.test(name)) {
    inputModalities.push('audio')
    outputModalities.push('audio')
  }

  return {
    context_length: model.context_length ?? inferContextLength(model.model_name),
    input_modalities: unique(inputModalities),
    output_modalities: unique(outputModalities),
    capabilities: unique(capabilities),
  }
}

export function inferApiInfo(model: PricingModel): ApiInfo {
  return {
    vendor_label: model.vendor_name || inferVendorLabel(model.model_name),
    vendor_icon: model.vendor_icon,
  }
}
