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
import { getCategorizedModels, getUserGroups } from '../api'
import type { ModelCategory, ModelOption, GroupOption } from '../types'

/**
 * Load the user's available models filtered by usage scenario (category) and
 * the user's groups. Returns ready-to-use selector options.
 */
export function useMediaModels(category: ModelCategory) {
  const { data: categorized = [], isLoading: isLoadingModels } = useQuery({
    queryKey: ['categorized-models'],
    queryFn: getCategorizedModels,
    staleTime: 60 * 1000,
  })

  const { data: groups = [] } = useQuery({
    queryKey: ['media-groups'],
    queryFn: getUserGroups,
    staleTime: 60 * 1000,
  })

  const models: ModelOption[] = useMemo(() => {
    return categorized
      .filter((m) => m.categories?.includes(category))
      .map((m) => ({
        label: m.model_name,
        value: m.model_name,
        category,
        channel_type: m.channel_type,
        channel_type_name: m.channel_type_name,
        channel_types_by_group: m.channel_types_by_group,
        channel_type_names_by_group: m.channel_type_names_by_group,
      }))
  }, [categorized, category])

  const groupOptions: GroupOption[] = useMemo(() => groups, [groups])

  return { models, groups: groupOptions, isLoadingModels }
}
