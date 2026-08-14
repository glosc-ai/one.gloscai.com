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
import type { AutoAddVendorCatalogItem } from './types'

interface LobeTocEntry {
  docsUrl: string
  fullTitle: string
  id: string
  param: {
    hasColor: boolean
  }
  title: string
}

interface LobeProviderMapping {
  Icon: unknown
  keywords: readonly string[]
}

const CURATED_NAMESPACE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  Anthropic: ['claude'],
  Arcee: ['arcee-ai'],
  Aws: ['amazon'],
  DeepSeek: ['deepseek-ai'],
  Kling: ['klingai'],
  Meta: ['meta-llama'],
  Mistral: ['mistralai'],
  Moonshot: ['moonshotai'],
  XiaomiMiMo: ['xiaomi'],
  XAI: ['grok'],
  Zhipu: ['z-ai'],
}

function normalizeMatchKey(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}]+/gu, '')
}

function getVendorTitle(entry: LobeTocEntry): {
  alias?: string
  name: string
} {
  const match = entry.fullTitle.match(/^(.*?)\s*\(([^()]*)\)\s*$/u)
  const name = (match?.[1] || entry.fullTitle || entry.title || entry.id).trim()
  const parenthetical = match?.[2]?.trim()

  if (
    parenthetical &&
    /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u.test(parenthetical)
  ) {
    return { alias: parenthetical, name }
  }
  return { name }
}

function addKeys(target: Set<string>, values: readonly string[]): void {
  for (const value of values) {
    const key = normalizeMatchKey(value)
    if (key) target.add(key)
  }
}

/**
 * Builds exact namespace candidates from LobeHub metadata. Provider mappings
 * and curated aliases own their keys before generic icon metadata is added.
 */
export function buildLobeVendorCatalog(
  toc: readonly LobeTocEntry[],
  providerMappings: readonly LobeProviderMapping[],
  iconExports: Readonly<Record<string, unknown>>
): AutoAddVendorCatalogItem[] {
  const tocByIcon = new Map<unknown, LobeTocEntry>()
  for (const entry of toc) {
    const icon = iconExports[entry.id]
    if (icon) tocByIcon.set(icon, entry)
  }

  const providerKeysByID = new Map<string, Set<string>>()
  for (const mapping of providerMappings) {
    const entry = tocByIcon.get(mapping.Icon)
    if (!entry) continue

    const keys = providerKeysByID.get(entry.id) ?? new Set<string>()
    addKeys(keys, mapping.keywords)
    providerKeysByID.set(entry.id, keys)
  }

  const claimedKeys = new Map<string, Set<string>>()
  for (const entry of toc) {
    const priorityKeys = new Set(providerKeysByID.get(entry.id))
    addKeys(priorityKeys, CURATED_NAMESPACE_ALIASES[entry.id] ?? [])
    for (const key of priorityKeys) {
      const owners = claimedKeys.get(key) ?? new Set<string>()
      owners.add(entry.id)
      claimedKeys.set(key, owners)
    }
  }

  const catalog: AutoAddVendorCatalogItem[] = []
  for (const entry of toc) {
    const title = getVendorTitle(entry)
    const matchKeys = new Set(providerKeysByID.get(entry.id))
    addKeys(matchKeys, CURATED_NAMESPACE_ALIASES[entry.id] ?? [])

    const selfKeys = [entry.id, entry.title, entry.docsUrl, title.name]
    for (const rawKey of selfKeys) {
      const key = normalizeMatchKey(rawKey)
      if (!key) continue

      const owners = claimedKeys.get(key)
      if (!owners || owners.has(entry.id)) matchKeys.add(key)
    }

    if (matchKeys.size === 0) continue

    catalog.push({
      name: title.name,
      ...(title.alias ? { alias: title.alias } : {}),
      icon: entry.param.hasColor ? `${entry.id}.Color` : entry.id,
      match_keys: [...matchKeys].sort(),
    })
  }

  return catalog.sort((left, right) => {
    if (left.name < right.name) return -1
    if (left.name > right.name) return 1
    return 0
  })
}

/**
 * Loads the installed LobeHub catalog only when the admin confirms the scan.
 */
export async function loadLobeVendorCatalog(): Promise<
  AutoAddVendorCatalogItem[]
> {
  const icons = await import('@lobehub/icons')
  return buildLobeVendorCatalog(
    icons.toc,
    icons.providerMappings,
    icons as Readonly<Record<string, unknown>>
  )
}
