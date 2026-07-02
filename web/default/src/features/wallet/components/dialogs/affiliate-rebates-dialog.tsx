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
import { useTranslation } from 'react-i18next'
import { formatNumber, formatQuota } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Dialog } from '@/components/dialog'
import { StatusBadge } from '@/components/status-badge'
import { useAffiliateRebates } from '../../hooks'
import { formatTimestamp, getPaymentMethodName } from '../../lib/billing'

interface AffiliateRebatesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

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
              placeholder={t('Search invited users or orders...')}
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
              value !== null && handlePageSizeChange(parseInt(value))
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
          {loading ? (
            <div className='space-y-3'>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className='rounded-lg border p-3 sm:p-4'>
                  <div className='flex items-start justify-between'>
                    <div className='flex-1 space-y-2'>
                      <Skeleton className='h-4 w-44' />
                      <Skeleton className='h-3 w-32' />
                    </div>
                    <Skeleton className='h-5 w-16' />
                  </div>
                  <div className='mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4'>
                    <Skeleton className='h-3 w-full' />
                    <Skeleton className='h-3 w-full' />
                    <Skeleton className='h-3 w-full' />
                  </div>
                </div>
              ))}
            </div>
          ) : records.length === 0 ? (
            <div className='text-muted-foreground flex min-h-40 flex-col items-center justify-center py-10 text-center'>
              <p className='text-sm font-medium'>
                {t('No referral records found')}
              </p>
              <p className='mt-1 text-xs'>
                {keyword
                  ? t('Try adjusting your search')
                  : t('Invited user top-ups will appear here')}
              </p>
            </div>
          ) : (
            <div className='space-y-3'>
              {records.map((record) => (
                <div
                  key={record.id}
                  className='hover:bg-muted/50 rounded-lg border p-3 transition-colors sm:p-4'
                >
                  <div className='flex items-start justify-between gap-2'>
                    <div className='min-w-0 space-y-1'>
                      <div className='flex min-w-0 items-center gap-2'>
                        <span className='truncate text-sm font-semibold'>
                          {record.invitee_username || t('Unknown User')}
                        </span>
                        <StatusBadge
                          label={`${t('User ID')}: ${record.invitee_id}`}
                          variant='neutral'
                          size='sm'
                          copyText={String(record.invitee_id)}
                        />
                      </div>
                      <div className='text-muted-foreground text-xs'>
                        {formatTimestamp(record.created_at)}
                      </div>
                    </div>
                    <StatusBadge
                      label={`+${formatQuota(record.rebate_quota)}`}
                      variant='success'
                      copyable={false}
                    />
                  </div>

                  <div className='mt-3 grid grid-cols-2 gap-3 sm:mt-4 sm:grid-cols-5 sm:gap-4'>
                    <div className='space-y-1'>
                      <Label className='text-muted-foreground text-xs'>
                        {t('Topup Amount')}
                      </Label>
                      <div className='text-sm font-semibold'>
                        {formatQuota(record.recharge_quota)}
                      </div>
                    </div>
                    <div className='space-y-1'>
                      <Label className='text-muted-foreground text-xs'>
                        {t('Payment Amount')}
                      </Label>
                      <div className='text-sm font-semibold'>
                        {formatNumber(record.recharge_amount)}
                      </div>
                    </div>
                    <div className='space-y-1'>
                      <Label className='text-muted-foreground text-xs'>
                        {t('Commission')}
                      </Label>
                      <div className='text-sm font-semibold text-green-600'>
                        +{formatQuota(record.rebate_quota)}
                      </div>
                    </div>
                    <div className='space-y-1'>
                      <Label className='text-muted-foreground text-xs'>
                        {t('Rate')}
                      </Label>
                      <div className='text-sm font-medium'>
                        {record.rebate_ratio}%
                      </div>
                    </div>
                    <div className='space-y-1'>
                      <Label className='text-muted-foreground text-xs'>
                        {t('Payment Method')}
                      </Label>
                      <div className='truncate text-sm font-medium'>
                        {getPaymentMethodName(record.payment_method, t)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
