import { type ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { formatLogQuota, formatTimestampToDate } from '@/lib/format'
import { DataTableColumnHeader } from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getModelCallLogStatusConfig } from '../constants'
import type { ModelCallLog } from '../types'

export function useModelCallLogsColumns(): ColumnDef<ModelCallLog>[] {
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
      accessorKey: 'model_name',
      meta: { label: t('Using Model'), mobileBadge: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Using Model')} />
      ),
      cell: ({ row }) => {
        const modelName = row.getValue('model_name') as string

        return modelName ? (
          <StatusBadge
            label={modelName}
            variant='neutral'
            autoColor={modelName}
            copyable
          />
        ) : (
          <span className='text-muted-foreground text-xs'>-</span>
        )
      },
    },
    {
      accessorKey: 'total_tokens',
      meta: { label: t('Consumed Tokens') },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Consumed Tokens')} />
      ),
      cell: ({ row }) => {
        const log = row.original
        const totalTokens = row.getValue('total_tokens') as number

        if (totalTokens <= 0) {
          return <span className='text-muted-foreground text-xs'>-</span>
        }

        return (
          <div className='flex flex-col gap-0.5'>
            <span className='font-mono text-sm font-medium tabular-nums'>
              {totalTokens.toLocaleString()}
            </span>
            <span className='text-muted-foreground/60 text-[11px]'>
              {log.prompt_tokens.toLocaleString()} /{' '}
              {log.completion_tokens.toLocaleString()}
            </span>
          </div>
        )
      },
    },
    {
      accessorKey: 'quota',
      meta: { label: t('Consumed Amount') },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Consumed Amount')} />
      ),
      cell: ({ row }) => {
        const quota = row.getValue('quota') as number

        return (
          <div className='min-w-24 font-mono text-sm font-medium'>
            {formatLogQuota(quota)}
          </div>
        )
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
        const log = row.original
        const config = getModelCallLogStatusConfig(status)
        const errorMessage = log.error_message || log.error_code
        const hasErrorInfo = status === 'failed' && Boolean(errorMessage)
        const badge = (
          <StatusBadge
            label={t(config.labelKey)}
            variant={config.variant}
            copyable={false}
            className={hasErrorInfo ? 'cursor-help' : undefined}
          />
        )

        if (!hasErrorInfo) {
          return badge
        }

        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger render={badge} />
              <TooltipContent className='max-w-sm items-start'>
                <div className='flex flex-col gap-1'>
                  <span className='wrap-break-word whitespace-pre-wrap'>
                    {errorMessage}
                  </span>
                  {log.error_code && log.error_message && (
                    <span className='text-background/70 text-[11px]'>
                      {t('Error Code')}:{' '}
                      <span className='font-mono'>{log.error_code}</span>
                    </span>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },
    {
      accessorKey: 'created_at',
      meta: { label: t('Time'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Time')} />
      ),
      cell: ({ row }) => {
        return (
          <div className='min-w-35 font-mono text-sm'>
            {formatTimestampToDate(row.getValue('created_at'))}
          </div>
        )
      },
    },
  ]
}
