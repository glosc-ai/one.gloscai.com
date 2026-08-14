import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import {
  type ColumnFiltersState,
  type OnChangeFn,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { useMediaQuery } from '@/hooks'
import { useTranslation } from 'react-i18next'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { DataTablePage, useDataTable } from '@/components/data-table'
import { getPaymentLogs } from '../api'
import {
  getPaymentLogStatusOptions,
  getPaymentMethodOptions,
} from '../constants'
import type { PaymentLogSortBy } from '../types'
import { usePaymentLogsColumns } from './payment-logs-columns'

const route = getRouteApi('/_authenticated/payment-logs/')

const PAYMENT_LOG_SORTABLE_COLUMNS = new Set<PaymentLogSortBy>([
  'id',
  'username',
  'amount',
  'payment_method',
  'status',
  'create_time',
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

export function PaymentLogsTable() {
  const { t } = useTranslation()
  const columns = usePaymentLogsColumns()
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
    columnFilters: [
      { columnId: 'status', searchKey: 'status', type: 'array' },
      {
        columnId: 'payment_method',
        searchKey: 'payment_method',
        type: 'array',
      },
    ],
  })

  const statusFilter = getSingleFilterValue(columnFilters, 'status')
  const paymentMethodFilter = getSingleFilterValue(
    columnFilters,
    'payment_method'
  )

  const sortParams = useMemo(() => {
    const activeSort = sorting[0]
    if (
      !activeSort ||
      !PAYMENT_LOG_SORTABLE_COLUMNS.has(activeSort.id as PaymentLogSortBy)
    ) {
      return {}
    }

    return {
      sort_by: activeSort.id as PaymentLogSortBy,
      sort_order: activeSort.desc ? 'desc' : 'asc',
    } as const
  }, [sorting])

  const sortBy = sortParams.sort_by
  const sortOrder = sortParams.sort_order

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
      'payment-logs',
      pagination.pageIndex + 1,
      pagination.pageSize,
      globalFilter,
      statusFilter,
      paymentMethodFilter,
      sortBy,
      sortOrder,
    ],
    queryFn: async () => {
      const result = await getPaymentLogs({
        p: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        keyword: globalFilter,
        status: statusFilter,
        payment_method: paymentMethodFilter,
        ...(sortBy && sortOrder
          ? { sort_by: sortBy, sort_order: sortOrder }
          : {}),
      })

      return {
        items: result.data?.items || [],
        total: result.data?.total || 0,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const paymentLogs = data?.items || []

  const { table } = useDataTable({
    data: paymentLogs,
    columns,
    totalCount: data?.total || 0,
    sorting,
    columnVisibility,
    columnFilters,
    globalFilter,
    pagination,
    enableRowSelection: false,
    onSortingChange: handleSortingChange,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange,
    onGlobalFilterChange,
    onColumnFiltersChange,
    manualPagination: true,
    manualFiltering: true,
    manualSorting: true,
    ensurePageInRange,
  })

  const statusOptions = useMemo(() => getPaymentLogStatusOptions(t), [t])
  const paymentMethodOptions = useMemo(() => getPaymentMethodOptions(t), [t])

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('No Payment Logs Found')}
      emptyDescription={t(
        'No payment logs available. Try adjusting your search or filters.'
      )}
      skeletonKeyPrefix='payment-logs-skeleton'
      toolbarProps={{
        searchPlaceholder: t('Filter by username, order number or ID...'),
        filters: [
          {
            columnId: 'status',
            title: t('Status'),
            options: statusOptions,
            singleSelect: true,
          },
          {
            columnId: 'payment_method',
            title: t('Payment Method'),
            options: paymentMethodOptions,
            singleSelect: true,
          },
        ],
      }}
    />
  )
}
