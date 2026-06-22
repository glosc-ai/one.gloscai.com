import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import {
  type ColumnFiltersState,
  type OnChangeFn,
  type SortingState,
  type VisibilityState,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useMediaQuery } from '@/hooks'
import { useTranslation } from 'react-i18next'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { DataTablePage } from '@/components/data-table'
import { getModelCallLogs } from '../api'
import { getModelCallLogStatusOptions } from '../constants'
import type { ModelCallLogSortBy } from '../types'
import { useModelCallLogsColumns } from './model-call-logs-columns'

const route = getRouteApi('/_authenticated/model-call-logs/')

const MODEL_CALL_LOG_SORTABLE_COLUMNS = new Set<ModelCallLogSortBy>([
  'id',
  'username',
  'model_name',
  'total_tokens',
  'quota',
  'status',
  'created_at',
])

function getSingleFilterValue(
  columnFilters: ColumnFiltersState,
  columnId: string
): string | undefined {
  const value = columnFilters.find((filter) => filter.id === columnId)?.value
  if (!Array.isArray(value)) return undefined
  const first = value[0]
  return typeof first === 'string' ? first : undefined
}

export function ModelCallLogsTable() {
  const { t } = useTranslation()
  const columns = useModelCallLogsColumns()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

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
    pagination: { defaultPage: 1, defaultPageSize: isMobile ? 10 : 20 },
    globalFilter: { enabled: true, key: 'filter' },
    columnFilters: [{ columnId: 'status', searchKey: 'status', type: 'array' }],
  })

  const statusFilter = getSingleFilterValue(columnFilters, 'status')
  const sortParams = useMemo(() => {
    const activeSort = sorting[0]
    if (
      !activeSort ||
      !MODEL_CALL_LOG_SORTABLE_COLUMNS.has(activeSort.id as ModelCallLogSortBy)
    ) {
      return {}
    }

    return {
      sort_by: activeSort.id as ModelCallLogSortBy,
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

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'model-call-logs',
      pagination.pageIndex + 1,
      pagination.pageSize,
      globalFilter,
      statusFilter,
      sortParams,
    ],
    queryFn: async () => {
      const result = await getModelCallLogs({
        p: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        keyword: globalFilter,
        status: statusFilter,
        ...sortParams,
      })

      return {
        items: result.data?.items || [],
        total: result.data?.total || 0,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const modelCallLogs = data?.items || []

  const table = useReactTable({
    data: modelCallLogs,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
      globalFilter,
      pagination,
    },
    enableRowSelection: false,
    onSortingChange: handleSortingChange,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange,
    onGlobalFilterChange,
    onColumnFiltersChange,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    manualPagination: true,
    manualFiltering: true,
    manualSorting: true,
    pageCount: Math.ceil((data?.total || 0) / pagination.pageSize),
  })

  const pageCount = table.getPageCount()
  useEffect(() => {
    ensurePageInRange(pageCount)
  }, [pageCount, ensurePageInRange])

  const statusOptions = useMemo(() => getModelCallLogStatusOptions(t), [t])

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('No Model Call Logs Found')}
      emptyDescription={t(
        'No model call logs available. Try adjusting your search or filters.'
      )}
      skeletonKeyPrefix='model-call-logs-skeleton'
      toolbarProps={{
        searchPlaceholder: t('Filter by username, model or ID...'),
        filters: [
          {
            columnId: 'status',
            title: t('Status'),
            options: statusOptions,
            singleSelect: true,
          },
        ],
      }}
    />
  )
}
