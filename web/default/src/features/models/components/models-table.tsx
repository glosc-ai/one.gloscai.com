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
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { type OnChangeFn, type SortingState } from '@tanstack/react-table'
import { useMediaQuery } from '@/hooks'
import { useTranslation } from 'react-i18next'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { DataTablePage, useDataTable } from '@/components/data-table'
import { getModels, searchModels, getVendors } from '../api'
import {
  DEFAULT_PAGE_SIZE,
  getModelStatusOptions,
  getPriceStatusOptions,
  getSyncStatusOptions,
} from '../constants'
import { modelsQueryKeys, vendorsQueryKeys } from '../lib'
import type { ModelSortBy } from '../types'
import { DataTableBulkActions } from './data-table-bulk-actions'
import { useModelsColumns } from './models-columns'
import { useModels } from './models-provider'

const route = getRouteApi('/_authenticated/models/$section')
const EMPTY_TAG_FILTER_VALUE = '__empty__'
const MODEL_SORTABLE_COLUMNS = new Set<ModelSortBy>([
  'id',
  'model_name',
  'created_time',
  'updated_time',
])

export function ModelsTable() {
  const { t } = useTranslation()
  const { selectedVendor } = useModels()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const [sorting, setSorting] = useState<SortingState>([])

  // URL state management
  const {
    globalFilter,
    onGlobalFilterChange,
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search: route.useSearch(),
    navigate: route.useNavigate(),
    pagination: {
      defaultPage: 1,
      defaultPageSize: isMobile ? 10 : DEFAULT_PAGE_SIZE,
    },
    globalFilter: { enabled: true, key: 'filter' },
    columnFilters: [
      { columnId: 'status', searchKey: 'status', type: 'array' },
      { columnId: 'vendor_id', searchKey: 'vendor', type: 'array' },
      { columnId: 'tags', searchKey: 'tag', type: 'array' },
      { columnId: 'sync_official', searchKey: 'sync', type: 'array' },
      { columnId: 'has_price', searchKey: 'price', type: 'array' },
    ],
  })

  // Extract filters from column filters
  const statusFilter =
    (columnFilters.find((f) => f.id === 'status')?.value as string[]) || []
  const vendorFilter =
    (columnFilters.find((f) => f.id === 'vendor_id')?.value as string[]) || []
  const tagFilter =
    (columnFilters.find((f) => f.id === 'tags')?.value as string[]) || []
  const syncFilter =
    (columnFilters.find((f) => f.id === 'sync_official')?.value as string[]) ||
    []
  const priceFilter =
    (columnFilters.find((f) => f.id === 'has_price')?.value as string[]) || []

  // Fetch vendors for filter
  const { data: vendorsData } = useQuery({
    queryKey: vendorsQueryKeys.list(),
    queryFn: () => getVendors({ page_size: 1000 }),
  })

  const vendors = useMemo(
    () => vendorsData?.data?.items || [],
    [vendorsData?.data?.items]
  )

  const vendorOptions = useMemo(() => {
    return vendors.map((v) => ({
      label: v.name,
      value: String(v.id),
    }))
  }, [vendors])

  // Determine whether to use search or regular list API
  const shouldSearch = Boolean(globalFilter?.trim())

  // Apply selected vendor from context or filter
  const activeVendorFilter =
    selectedVendor ||
    (vendorFilter.length > 0 && !vendorFilter.includes('all')
      ? vendorFilter[0]
      : undefined)
  const activeTagFilter =
    tagFilter.length > 0 && !tagFilter.includes('all')
      ? tagFilter[0]
      : undefined

  const sortParams = useMemo(() => {
    const activeSort = sorting[0]
    if (
      !activeSort ||
      !MODEL_SORTABLE_COLUMNS.has(activeSort.id as ModelSortBy)
    ) {
      return {}
    }

    return {
      sort_by: activeSort.id as ModelSortBy,
      sort_order: activeSort.desc ? 'desc' : 'asc',
    } as const
  }, [sorting])

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting((previous) => {
      const next = typeof updater === 'function' ? updater(previous) : updater
      if (pagination.pageIndex > 0) {
        onPaginationChange({ ...pagination, pageIndex: 0 })
      }
      return next
    })
  }

  // Fetch models data
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  const { data, isLoading, isFetching } = useQuery({
    queryKey: modelsQueryKeys.list({
      keyword: globalFilter,
      vendor: activeVendorFilter,
      tag: activeTagFilter,
      status:
        statusFilter.length > 0 && !statusFilter.includes('all')
          ? statusFilter[0]
          : undefined,
      sync_official:
        syncFilter.length > 0 && !syncFilter.includes('all')
          ? syncFilter[0]
          : undefined,
      has_price:
        priceFilter.length > 0 && !priceFilter.includes('all')
          ? priceFilter[0]
          : undefined,
      ...sortParams,
      p: pagination.pageIndex + 1,
      page_size: pagination.pageSize,
    }),
    queryFn: async () => {
      if (shouldSearch || activeVendorFilter) {
        return searchModels({
          keyword: globalFilter,
          vendor: activeVendorFilter,
          tag: activeTagFilter,
          status:
            statusFilter.length > 0 && !statusFilter.includes('all')
              ? statusFilter[0]
              : undefined,
          sync_official:
            syncFilter.length > 0 && !syncFilter.includes('all')
              ? syncFilter[0]
              : undefined,
          has_price:
            priceFilter.length > 0 && !priceFilter.includes('all')
              ? priceFilter[0]
              : undefined,
          ...sortParams,
          p: pagination.pageIndex + 1,
          page_size: pagination.pageSize,
        })
      } else {
        return getModels({
          tag: activeTagFilter,
          status:
            statusFilter.length > 0 && !statusFilter.includes('all')
              ? statusFilter[0]
              : undefined,
          sync_official:
            syncFilter.length > 0 && !syncFilter.includes('all')
              ? syncFilter[0]
              : undefined,
          has_price:
            priceFilter.length > 0 && !priceFilter.includes('all')
              ? priceFilter[0]
              : undefined,
          ...sortParams,
          p: pagination.pageIndex + 1,
          page_size: pagination.pageSize,
        })
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const models = data?.data?.items || []
  const totalCount = data?.data?.total || 0
  const vendorCounts = data?.data?.vendor_counts
  const tagCounts = data?.data?.tag_counts

  // Columns configuration
  const columns = useModelsColumns(vendors)

  // React Table instance
  const { table } = useDataTable({
    data: models,
    columns,
    totalCount,
    initialColumnVisibility: {
      description: false,
      bound_channels: false,
      quota_types: false,
    },
    sorting,
    columnFilters,
    pagination,
    globalFilter,
    enableRowSelection: true,
    onSortingChange: handleSortingChange,
    onColumnFiltersChange,
    onPaginationChange,
    onGlobalFilterChange,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    ensurePageInRange,
  })

  // Prepare filter options
  const vendorFilterOptions = [
    {
      label: `${t('All Vendors')}${vendorCounts?.all ? ` (${vendorCounts.all})` : ''}`,
      value: 'all',
    },
    ...vendorOptions.map((option) => ({
      label: `${option.label}${vendorCounts?.[option.value] ? ` (${vendorCounts[option.value]})` : ''}`,
      value: option.value,
    })),
  ]
  const tagFilterOptions = [
    {
      label: t('All Tags'),
      value: 'all',
    },
    {
      label: `${t('No Tags')}${tagCounts?.[EMPTY_TAG_FILTER_VALUE] ? ` (${tagCounts[EMPTY_TAG_FILTER_VALUE]})` : ''}`,
      value: EMPTY_TAG_FILTER_VALUE,
    },
    ...Object.entries(tagCounts || {})
      .filter(([tag]) => tag !== EMPTY_TAG_FILTER_VALUE)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tag, count]) => ({
        label: `${tag}${count ? ` (${count})` : ''}`,
        value: tag,
      })),
  ]

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('No Models Found')}
      emptyDescription={t(
        'No models available. Create your first model to get started.'
      )}
      skeletonKeyPrefix='model-skeleton'
      applyHeaderSize
      toolbarProps={{
        searchPlaceholder: t('Filter by model name...'),
        filters: [
          {
            columnId: 'status',
            title: t('Status'),
            options: [...getModelStatusOptions(t)],
            singleSelect: true,
          },
          {
            columnId: 'vendor_id',
            title: t('Vendor'),
            options: vendorFilterOptions,
            singleSelect: true,
          },
          {
            columnId: 'tags',
            title: t('Tags'),
            options: tagFilterOptions,
            singleSelect: true,
          },
          {
            columnId: 'sync_official',
            title: t('Official Sync'),
            options: [...getSyncStatusOptions(t)],
            singleSelect: true,
          },
          {
            columnId: 'has_price',
            title: t('Pricing'),
            options: [...getPriceStatusOptions(t)],
            singleSelect: true,
          },
        ],
      }}
      bulkActions={<DataTableBulkActions table={table} vendors={vendors} />}
    />
  )
}
