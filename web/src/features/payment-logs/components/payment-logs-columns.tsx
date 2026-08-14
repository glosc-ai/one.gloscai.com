import { type ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { formatCurrencyFromUSD } from '@/lib/currency'
import { formatTimestampToDate } from '@/lib/format'
import { DataTableColumnHeader } from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import {
  getPaymentLogStatusConfig,
  getPaymentMethodLabelKey,
} from '../constants'
import type { PaymentLog } from '../types'

export function usePaymentLogsColumns(): ColumnDef<PaymentLog>[] {
  const { t } = useTranslation()

  return [
    {
      accessorKey: 'id',
      meta: { label: t('ID'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('ID')} />
      ),
      cell: ({ row }) => {
        return <TableId value={row.getValue('id') as number} className='w-16' />
      },
    },
    {
      accessorKey: 'username',
      meta: { label: t('Username'), mobileTitle: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Username')} />
      ),
      cell: ({ row }) => {
        const log = row.original
        const username = log.username || t('User {{id}}', { id: log.user_id })

        return <div className='max-w-45 truncate font-medium'>{username}</div>
      },
    },
    {
      accessorKey: 'amount',
      meta: { label: t('Payment amount') },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Payment amount')} />
      ),
      cell: ({ row }) => {
        const amount = row.getValue('amount') as number

        return (
          <div className='min-w-24 font-mono text-sm font-medium'>
            {formatCurrencyFromUSD(amount, { abbreviate: false })}
          </div>
        )
      },
    },
    {
      accessorKey: 'payment_method',
      meta: { label: t('Payment Method'), mobileBadge: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Payment Method')} />
      ),
      cell: ({ row }) => {
        const method = row.getValue('payment_method') as string
        const labelKey = getPaymentMethodLabelKey(method)

        return (
          <StatusBadge
            label={t(labelKey)}
            variant='neutral'
            autoColor={method}
            copyable={false}
          />
        )
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },
    {
      accessorKey: 'status',
      meta: { label: t('Status'), mobileBadge: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Status')} />
      ),
      cell: ({ row }) => {
        const status = row.getValue('status') as string
        const config = getPaymentLogStatusConfig(status)

        return (
          <StatusBadge
            label={t(config.labelKey)}
            variant={config.variant}
            copyable={false}
          />
        )
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },
    {
      accessorKey: 'create_time',
      meta: { label: t('Time'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Time')} />
      ),
      cell: ({ row }) => {
        return (
          <div className='min-w-35 font-mono text-sm'>
            {formatTimestampToDate(row.getValue('create_time'))}
          </div>
        )
      },
    },
  ]
}
