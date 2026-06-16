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
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  formatTokenCount,
  inferApiInfo,
  inferModelMetadata,
} from '@/features/pricing/lib/model-metadata'
import type {
  PricingData,
  PricingModel,
  PricingVendor,
} from '@/features/pricing/types'

export type LiveHomeModel = {
  name: string
  provider: string
  context: string
  type: string
  accent: boolean
}

async function getHomePricing(): Promise<PricingData | null> {
  try {
    const res = await api.get<PricingData>('/api/pricing', {
      skipBusinessError: true,
      skipErrorHandler: true,
    })
    return res.data?.success ? res.data : null
  } catch {
    return null
  }
}

function enrichPricingModel(
  model: PricingModel,
  vendorMap: Map<number, PricingVendor>
): PricingModel {
  const vendor = model.vendor_id ? vendorMap.get(model.vendor_id) : undefined
  return {
    ...model,
    key: model.model_name,
    vendor_name: vendor?.name,
    vendor_icon: vendor?.icon,
    vendor_description: vendor?.description,
  }
}

function getModelType(model: PricingModel): string {
  const metadata = inferModelMetadata(model)
  const endpoints = new Set(model.supported_endpoint_types || [])

  if (metadata.output_modalities.includes('video')) return 'Video'
  if (
    metadata.output_modalities.includes('image') ||
    endpoints.has('image-generation')
  ) {
    return 'Image'
  }
  if (
    metadata.input_modalities.includes('audio') ||
    metadata.output_modalities.includes('audio')
  ) {
    return 'Audio'
  }
  if (metadata.capabilities.includes('embeddings')) return 'Embeddings'
  if (metadata.capabilities.includes('reasoning')) return 'Reasoning'
  if (
    metadata.input_modalities.length > 1 ||
    metadata.output_modalities.length > 1
  ) {
    return 'Multimodal'
  }
  if (metadata.context_length >= 200_000) return 'Long context'

  return 'Text / Chat'
}

function getModelScore(model: PricingModel): number {
  const name = model.model_name.toLowerCase()
  const type = getModelType(model)
  let score = 0

  if (/gpt-4o|gpt-4\.1|gpt-5|^o[134]/.test(name)) score += 120
  if (/claude.*(?:opus|sonnet|4)/.test(name)) score += 110
  if (/gemini.*(?:pro|flash|2\.5)/.test(name)) score += 100
  if (/deepseek/.test(name)) score += 90
  if (/qwen|qwq|qvq/.test(name)) score += 80
  if (/llama|mistral|mixtral|grok|kimi/.test(name)) score += 70
  if (/dall.?e|imagen|sdxl|stable|sora|veo|midjourney/.test(name)) score += 60
  if (type === 'Text / Chat') score += 20
  if (type === 'Multimodal' || type === 'Reasoning') score += 18
  if (type === 'Long context') score += 14
  if (model.vendor_id) score += 6
  if (model.tags) score += 4

  return score
}

function toLiveHomeModel(model: PricingModel): LiveHomeModel {
  const metadata = inferModelMetadata(model)
  const apiInfo = inferApiInfo(model)
  const type = getModelType(model)

  return {
    name: model.model_name,
    provider: model.vendor_name || apiInfo.vendor_label,
    context: formatTokenCount(metadata.context_length),
    type,
    accent: type !== 'Text / Chat',
  }
}

export function useLiveHomeModels(limit = 8) {
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['home', 'live-models'],
    queryFn: getHomePricing,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
    retry: false,
  })

  const models = useMemo(() => {
    if (!data?.data || !data.vendors) return []

    const vendorMap = new Map(data.vendors.map((vendor) => [vendor.id, vendor]))
    return data.data
      .filter((model) => model.model_name)
      .map((model) => enrichPricingModel(model, vendorMap))
      .sort((a, b) => {
        const scoreDiff = getModelScore(b) - getModelScore(a)
        if (scoreDiff !== 0) return scoreDiff
        return a.model_name.localeCompare(b.model_name)
      })
      .slice(0, limit)
      .map(toLiveHomeModel)
  }, [data, limit])

  return {
    models,
    totalCount: data?.data?.length ?? 0,
    isLoading,
    isFetching,
  }
}
