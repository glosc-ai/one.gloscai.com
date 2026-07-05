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
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatNumber, formatQuota } from '@/lib/format'

import { useAffiliateRebates } from '../../hooks'
import { formatTimestamp, getPaymentMethodName } from '../../lib/billing'

interface AffiliateRebatesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const rebateDialogSkeletonKeys = [
  'rebate-skeleton-a',
  'rebate-skeleton-b',
  'rebate-skeleton-c',
  'rebate-skeleton-d',
  'rebate-skeleton-e',
]

export function AffiliateRebatesDialog({
  open,
  onOpenChange,
}: AffiliateRebatesDialogProps) {
  const { t } = useTranslation()
  const {
    records,
    total,
    page,
    pageSize,
    keyword,
    loading,
    handlePageChange,
    handlePageSizeChange,
    handleSearch,
  } = useAffiliateRebates({ enabled: open })

  const totalPages = Math.ceil(total / pageSize)
  let recordsContent: ReactNode

  if (loading) {
    recordsContent = (
      <div className='rounded-lg border'>
        <Table className='min-w-[900px]'>
          <TableHeader>
            <TableRow className='bg-muted/40 hover:bg-muted/40'>
              <TableHead className='px-4'>{t('User ID')}</TableHead>
              <TableHead>{t('Created At')}</TableHead>
              <TableHead>{t('Topup Amount')}</TableHead>
              <TableHead>{t('Payment Amount')}</TableHead>
              <TableHead>{t('Commission')}</TableHead>
              <TableHead>{t('Rate')}</TableHead>
              <TableHead className='px-4'>{t('Payment Method')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rebateDialogSkeletonKeys.map((key) => (
              <TableRow key={key}>
                <TableCell className='px-4'>
                  <Skeleton className='h-5 w-16' />
                </TableCell>
                <TableCell>
                  <Skeleton className='h-5 w-36' />
                </TableCell>
                <TableCell>
                  <Skeleton className='h-5 w-20' />
                </TableCell>
                <TableCell>
                  <Skeleton className='h-5 w-20' />
                </TableCell>
                <TableCell>
                  <Skeleton className='h-5 w-16' />
                </TableCell>
                <TableCell>
                  <Skeleton className='h-5 w-12' />
                </TableCell>
                <TableCell className='px-4'>
                  <Skeleton className='h-5 w-32' />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  } else if (records.length === 0) {
    recordsContent = (
      <div className='text-muted-foreground flex min-h-40 flex-col items-center justify-center py-10 text-center'>
        <p className='text-sm font-medium'>{t('No referral records found')}</p>
        <p className='mt-1 text-xs'>
          {keyword
            ? t('Try adjusting your search')
            : t('Invited user top-ups will appear here')}
        </p>
      </div>
    )
  } else {
    recordsContent = (
      <div className='rounded-lg border'>
        <Table className='min-w-[900px]'>
          <TableHeader>
            <TableRow className='bg-muted/40 hover:bg-muted/40'>
              <TableHead className='px-4'>{t('User ID')}</TableHead>
              <TableHead>{t('Created At')}</TableHead>
              <TableHead>{t('Topup Amount')}</TableHead>
              <TableHead>{t('Payment Amount')}</TableHead>
              <TableHead>{t('Commission')}</TableHead>
              <TableHead>{t('Rate')}</TableHead>
              <TableHead className='px-4'>{t('Payment Method')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => (
              <TableRow key={record.id}>
                <TableCell className='px-4 font-mono font-semibold'>
                  {record.invitee_id}
                </TableCell>
                <TableCell className='text-muted-foreground'>
                  {formatTimestamp(record.created_at)}
                </TableCell>
                <TableCell className='font-semibold'>
                  {formatQuota(record.recharge_quota)}
                </TableCell>
                <TableCell>{formatNumber(record.recharge_amount)}</TableCell>
                <TableCell>
                  <Badge
                    variant='secondary'
                    className='bg-success/10 text-success'
                  >
                    +{formatQuota(record.rebate_quota)}
                  </Badge>
                </TableCell>
                <TableCell>{record.rebate_ratio}%</TableCell>
                <TableCell className='max-w-48 truncate px-4 font-medium'>
                  {getPaymentMethodName(record.payment_method, t)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('Referral Records')}
      description={t('Invited user top-ups and earned rewards')}
      contentClassName='flex max-h-[calc(100dvh-2rem)] flex-col max-sm:w-screen max-sm:max-w-none max-sm:rounded-none max-sm:p-4 sm:max-w-4xl'
      contentHeight='auto'
      bodyClassName='space-y-3'
    >
      <div className='min-h-0 space-y-3'>
        <div className='flex items-center gap-2'>
          <div className='relative flex-1'>
            <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
            <Input
              aria-label={t('Search')}
              placeholder={t('Search user IDs or orders...')}
              value={keyword}
              onChange={(e) => handleSearch(e.target.value)}
              className='h-9 pl-10'
            />
          </div>
          <Select
            items={[
              { value: '10', label: t('10 / page') },
              { value: '20', label: t('20 / page') },
              { value: '50', label: t('50 / page') },
              { value: '100', label: t('100 / page') },
            ]}
            value={pageSize.toString()}
            onValueChange={(value) =>
              value !== null && handlePageSizeChange(Number.parseInt(value))
            }
          >
            <SelectTrigger className='h-9 w-[92px] sm:w-32'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                <SelectItem value='10'>{t('10 / page')}</SelectItem>
                <SelectItem value='20'>{t('20 / page')}</SelectItem>
                <SelectItem value='50'>{t('50 / page')}</SelectItem>
                <SelectItem value='100'>{t('100 / page')}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className='max-h-[min(54vh,520px)] pr-3 sm:pr-4'>
          {recordsContent}
        </ScrollArea>

        {!loading && records.length > 0 && (
          <div className='flex flex-col items-center gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between'>
            <div className='text-muted-foreground text-xs sm:text-sm'>
              {t('Showing')} {(page - 1) * pageSize + 1}-
              {Math.min(page * pageSize, total)} {t('of')} {total}
            </div>
            <div className='flex items-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                aria-label={t('Previous page')}
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className='h-8 w-8 p-0'
              >
                <ChevronLeft className='h-4 w-4' />
              </Button>
              <div className='text-muted-foreground flex items-center gap-1 text-sm'>
                <span className='font-medium'>{page}</span>
                <span>/</span>
                <span>{totalPages}</span>
              </div>
              <Button
                variant='outline'
                size='sm'
                aria-label={t('Next page')}
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                className='h-8 w-8 p-0'
              >
                <ChevronRight className='h-4 w-4' />
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  )
}
