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
import {
  ArrowRightLeft,
  BadgeDollarSign,
  ChevronLeft,
  ChevronRight,
  Gift,
  History,
  Search,
  Users,
  WalletCards,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { getSelf } from '@/lib/api'
import { formatPercent, formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'

import { TransferDialog } from './components/dialogs/transfer-dialog'
import { useAffiliate, useAffiliateRebates, useTopupInfo } from './hooks'
import { formatTimestamp, getPaymentMethodName } from './lib/billing'
import type { AffiliateRebateRecord, UserWalletData } from './types'

type StatTone = 'orange' | 'green' | 'blue' | 'slate'

interface ReferralStatCardProps {
  label: string
  value: string
  description?: string
  icon: LucideIcon
  tone: StatTone
  loading?: boolean
}

const statToneClassNames: Record<StatTone, string> = {
  orange: 'text-orange-400',
  green: 'text-emerald-400',
  blue: 'text-sky-300',
  slate: 'text-slate-100',
}
const recordSkeletonKeys = ['record-a', 'record-b', 'record-c', 'record-d']

function ReferralStatCard(props: ReferralStatCardProps) {
  const Icon = props.icon

  return (
    <div className='min-h-32 rounded-xl border border-[#263552] bg-[#121827] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'>
      <div className='flex items-center gap-2 text-sm font-semibold text-slate-400 sm:text-base'>
        <Icon className={cn('size-4', statToneClassNames[props.tone])} />
        <span className='truncate'>{props.label}</span>
      </div>
      {props.loading ? (
        <Skeleton className='mt-5 h-8 w-28 bg-white/10' />
      ) : (
        <div
          className={cn(
            'mt-5 truncate text-3xl font-bold tracking-normal tabular-nums',
            statToneClassNames[props.tone]
          )}
        >
          {props.value}
        </div>
      )}
      {props.description ? (
        <p className='mt-3 line-clamp-2 text-sm leading-5 text-slate-400'>
          {props.description}
        </p>
      ) : null}
    </div>
  )
}

interface ReferralCopyFieldProps {
  id: string
  label: string
  value: string
  tooltip: string
  loading?: boolean
}

function ReferralCopyField(props: ReferralCopyFieldProps) {
  if (props.loading) {
    return (
      <div className='min-w-0 space-y-2'>
        <label
          htmlFor={props.id}
          className='block text-sm font-semibold text-slate-200'
        >
          {props.label}
        </label>
        <div className='flex min-w-0 items-center gap-2 rounded-xl border border-[#2c4163] bg-[#0c1425] p-2'>
          <Skeleton className='h-10 flex-1 bg-white/10' />
          <Skeleton className='h-10 w-24 bg-white/10' />
        </div>
      </div>
    )
  }

  return (
    <div className='min-w-0 space-y-2'>
      <label
        htmlFor={props.id}
        className='block text-sm font-semibold text-slate-200'
      >
        {props.label}
      </label>
      <div className='flex min-w-0 items-center gap-2 rounded-xl border border-[#2c4163] bg-[#0c1425] p-2'>
        <Input
          id={props.id}
          value={props.value}
          readOnly
          className='h-10 border-0 bg-transparent px-1 font-mono text-sm text-slate-100 shadow-none focus-visible:ring-0 sm:text-base'
        />
        <CopyButton
          value={props.value}
          variant='outline'
          size='default'
          className='h-10 gap-2 border-[#53657f] bg-[#1d293a] px-3 text-slate-100 hover:bg-[#26354a] hover:text-white'
          iconClassName='size-4'
          tooltip={props.tooltip}
          aria-label={props.tooltip}
        >
          <span className='hidden sm:inline'>{props.tooltip}</span>
        </CopyButton>
      </div>
    </div>
  )
}

interface ReferralRecordListProps {
  records: AffiliateRebateRecord[]
  loading: boolean
  keyword: string
}

function ReferralRecordList(props: ReferralRecordListProps) {
  const { t } = useTranslation()

  if (props.loading) {
    return (
      <div className='space-y-3'>
        {recordSkeletonKeys.map((key) => (
          <div
            key={key}
            className='rounded-xl border border-[#263552] bg-[#0c1425] p-4'
          >
            <div className='flex items-start justify-between gap-4'>
              <div className='space-y-2'>
                <Skeleton className='h-4 w-40 bg-white/10' />
                <Skeleton className='h-3 w-28 bg-white/10' />
              </div>
              <Skeleton className='h-7 w-24 bg-white/10' />
            </div>
            <div className='mt-4 grid gap-3 sm:grid-cols-4'>
              <Skeleton className='h-10 bg-white/10' />
              <Skeleton className='h-10 bg-white/10' />
              <Skeleton className='h-10 bg-white/10' />
              <Skeleton className='h-10 bg-white/10' />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (props.records.length === 0) {
    return (
      <div className='flex min-h-28 items-center justify-center rounded-xl border border-dashed border-[#344866] bg-[#0c1425]/80 px-4 py-8 text-center'>
        <div>
          <p className='text-sm font-semibold text-slate-300'>
            {t('No referral records found')}
          </p>
          <p className='mt-1 text-xs text-slate-500'>
            {props.keyword
              ? t('Try adjusting your search')
              : t('Invited user top-ups will appear here')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-3'>
      {props.records.map((record) => (
        <div
          key={record.id}
          className='rounded-xl border border-[#263552] bg-[#0c1425] p-4 transition-colors hover:border-[#3a5277] hover:bg-[#101a2e]'
        >
          <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
            <div className='min-w-0 space-y-1'>
              <div className='flex min-w-0 flex-wrap items-center gap-2'>
                <span className='truncate text-sm font-semibold text-slate-100'>
                  {record.invitee_username || t('Unknown User')}
                </span>
                <span className='rounded-md border border-[#344866] bg-[#121827] px-2 py-0.5 text-xs text-slate-400'>
                  {t('User ID')}: {record.invitee_id}
                </span>
              </div>
              <div className='text-xs text-slate-500'>
                {formatTimestamp(record.created_at)}
              </div>
            </div>
            <div className='w-fit rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-sm font-semibold text-emerald-300'>
              +{formatQuota(record.rebate_quota)}
            </div>
          </div>

          <div className='mt-4 grid gap-3 sm:grid-cols-4'>
            <ReferralRecordMetric
              label={t('Topup Amount')}
              value={formatQuota(record.recharge_quota)}
            />
            <ReferralRecordMetric
              label={t('Commission')}
              value={`+${formatQuota(record.rebate_quota)}`}
              valueClassName='text-emerald-300'
            />
            <ReferralRecordMetric
              label={t('Rate')}
              value={`${record.rebate_ratio}%`}
            />
            <ReferralRecordMetric
              label={t('Payment Method')}
              value={getPaymentMethodName(record.payment_method, t)}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

interface ReferralRecordMetricProps {
  label: string
  value: string
  valueClassName?: string
}

function ReferralRecordMetric(props: ReferralRecordMetricProps) {
  return (
    <div className='min-w-0 rounded-lg bg-[#121827] px-3 py-2'>
      <div className='truncate text-xs text-slate-500'>{props.label}</div>
      <div
        className={cn(
          'mt-1 truncate text-sm font-semibold text-slate-100',
          props.valueClassName
        )}
      >
        {props.value}
      </div>
    </div>
  )
}

export function ReferralProgram() {
  const { t } = useTranslation()
  const [user, setUser] = useState<UserWalletData | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const { topupInfo } = useTopupInfo()
  const {
    affiliateCode,
    affiliateLink,
    loading: affiliateLoading,
    transferring,
    transferQuota,
  } = useAffiliate()
  const {
    records,
    total,
    page,
    pageSize,
    keyword,
    loading: recordsLoading,
    handlePageChange,
    handleSearch,
  } = useAffiliateRebates({ initialPageSize: 5 })

  const fetchUser = useCallback(async () => {
    try {
      setUserLoading(true)
      const response = await getSelf()
      if (response.success && response.data) {
        setUser(response.data as UserWalletData)
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch user data:', error)
    } finally {
      setUserLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  const rebateRatio = topupInfo?.affiliate_rebate_ratio ?? 0
  const availableQuota = user?.aff_quota ?? 0
  const hasRewards = availableQuota > 0
  const complianceConfirmed = topupInfo?.payment_compliance_confirmed !== false
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const handleTransfer = async (amount: number) => {
    const success = await transferQuota(amount)
    if (success) {
      await fetchUser()
    }
    return success
  }

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Referral Program')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <div className='mx-auto w-full max-w-7xl rounded-2xl bg-[#070a12] p-4 text-slate-100 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-6'>
            <div className='grid gap-4 lg:grid-cols-4'>
              <ReferralStatCard
                label={t('My Rebate Rate')}
                value={formatPercent(rebateRatio)}
                description={t(
                  'Invited users add funds, and you earn this percentage as rewards.'
                )}
                icon={BadgeDollarSign}
                tone='orange'
                loading={affiliateLoading}
              />
              <ReferralStatCard
                label={t('Invited Users')}
                value={String(user?.aff_count ?? 0)}
                icon={Users}
                tone='slate'
                loading={userLoading}
              />
              <ReferralStatCard
                label={t('Transferable Rewards')}
                value={formatQuota(availableQuota)}
                icon={WalletCards}
                tone='green'
                loading={userLoading}
              />
              <ReferralStatCard
                label={t('Lifetime Rewards')}
                value={formatQuota(user?.aff_history_quota ?? 0)}
                icon={History}
                tone='slate'
                loading={userLoading}
              />
            </div>

            <section className='mt-6 rounded-2xl border border-[#263552] bg-[#101624] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-6'>
              <div className='mb-6 flex items-start gap-3'>
                <div className='flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#344866] bg-[#121e32]'>
                  <Gift className='size-5 text-orange-300' />
                </div>
                <div className='min-w-0'>
                  <h3 className='text-lg font-bold text-slate-50'>
                    {t('Invite Rewards')}
                  </h3>
                  <p className='mt-1 text-sm text-slate-400'>
                    {t(
                      'Invite new users and transfer earned rewards to your account balance.'
                    )}
                  </p>
                </div>
              </div>

              <div className='grid gap-4 lg:grid-cols-2'>
                <ReferralCopyField
                  id='referral-code'
                  label={t('My Invitation Code')}
                  value={affiliateCode}
                  tooltip={t('Copy invitation code')}
                  loading={affiliateLoading}
                />
                <ReferralCopyField
                  id='referral-link'
                  label={t('Invitation Link')}
                  value={affiliateLink}
                  tooltip={t('Copy invitation link')}
                  loading={affiliateLoading}
                />
              </div>

              <div className='mt-6 rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 text-orange-100 sm:p-5'>
                <h4 className='text-sm font-bold'>{t('How it works')}</h4>
                <ol className='mt-3 space-y-2 text-sm leading-6 text-orange-200'>
                  <li>
                    1.{' '}
                    {t(
                      'Share your invitation code or referral link with new users.'
                    )}
                  </li>
                  <li>
                    2.{' '}
                    {t(
                      'When invited users add funds, you earn rewards based on the current rebate rate.'
                    )}
                  </li>
                  <li>
                    3.{' '}
                    {t(
                      'Available rewards can be transferred to your account balance at any time.'
                    )}
                  </li>
                </ol>
              </div>
            </section>

            <section className='mt-6 rounded-2xl border border-[#263552] bg-[#101624] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-6'>
              <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
                <div className='min-w-0'>
                  <h3 className='text-lg font-bold text-slate-50'>
                    {t('Transfer Rewards to Balance')}
                  </h3>
                  <p className='mt-1 text-sm text-slate-400'>
                    {t('Move all available rewards into your account balance.')}
                  </p>
                  <p
                    className={cn(
                      'mt-4 text-sm font-semibold',
                      hasRewards ? 'text-emerald-300' : 'text-amber-300'
                    )}
                  >
                    {hasRewards
                      ? formatQuota(availableQuota)
                      : t('No transferable rewards')}
                  </p>
                  {!complianceConfirmed ? (
                    <p className='mt-2 text-xs text-slate-500'>
                      {t(
                        'Referral reward transfer is disabled until the administrator confirms compliance terms.'
                      )}
                    </p>
                  ) : null}
                </div>
                <Button
                  onClick={() => setTransferDialogOpen(true)}
                  disabled={!hasRewards || !complianceConfirmed}
                  className='h-11 w-full gap-2 bg-orange-600 px-5 text-white hover:bg-orange-500 sm:w-auto'
                >
                  <ArrowRightLeft className='size-4' />
                  {t('Transfer to Balance')}
                </Button>
              </div>
            </section>

            <section className='mt-6 rounded-2xl border border-[#263552] bg-[#101624] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-6'>
              <div className='mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                <h3 className='text-lg font-bold text-slate-50'>
                  {t('Invited Users')}
                </h3>
                <div className='relative w-full sm:w-80'>
                  <Search className='absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500' />
                  <Input
                    aria-label={t('Search')}
                    placeholder={t('Search invited users or orders...')}
                    value={keyword}
                    onChange={(event) => handleSearch(event.target.value)}
                    className='h-10 border-[#344866] bg-[#0c1425] pl-10 text-slate-100 placeholder:text-slate-500 focus-visible:ring-sky-400/30'
                  />
                </div>
              </div>

              <ReferralRecordList
                records={records}
                loading={recordsLoading}
                keyword={keyword}
              />

              {!recordsLoading && total > 0 ? (
                <div className='mt-4 flex flex-col items-center gap-3 border-t border-[#263552] pt-4 sm:flex-row sm:justify-between'>
                  <div className='text-xs text-slate-500 sm:text-sm'>
                    {t('Showing')} {(page - 1) * pageSize + 1}-
                    {Math.min(page * pageSize, total)} {t('of')} {total}
                  </div>
                  <div className='flex items-center gap-2'>
                    <Button
                      variant='outline'
                      size='icon'
                      aria-label={t('Previous page')}
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page <= 1}
                      className='border-[#344866] bg-[#0c1425] text-slate-200 hover:bg-[#172235] hover:text-white'
                    >
                      <ChevronLeft className='size-4' />
                    </Button>
                    <div className='min-w-14 text-center text-sm text-slate-400'>
                      <span className='font-semibold text-slate-100'>
                        {page}
                      </span>
                      <span className='mx-1'>/</span>
                      <span>{totalPages}</span>
                    </div>
                    <Button
                      variant='outline'
                      size='icon'
                      aria-label={t('Next page')}
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page >= totalPages}
                      className='border-[#344866] bg-[#0c1425] text-slate-200 hover:bg-[#172235] hover:text-white'
                    >
                      <ChevronRight className='size-4' />
                    </Button>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <TransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        onConfirm={handleTransfer}
        availableQuota={availableQuota}
        transferring={transferring}
      />
    </>
  )
}
