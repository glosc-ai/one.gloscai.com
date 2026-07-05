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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TitledCard } from '@/components/ui/titled-card'
import { getSelf } from '@/lib/api'
import { formatPercent, formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'

import { TransferDialog } from './components/dialogs/transfer-dialog'
import { useAffiliate, useAffiliateRebates, useTopupInfo } from './hooks'
import { formatTimestamp, getPaymentMethodName } from './lib/billing'
import type { AffiliateRebateRecord, UserWalletData } from './types'

type StatTone = 'orange' | 'green' | 'slate'

interface ReferralStatCardProps {
  label: string
  value: string
  description?: string
  icon: LucideIcon
  tone: StatTone
  loading?: boolean
}

const statToneClassNames: Record<StatTone, string> = {
  orange: 'text-warning',
  green: 'text-success',
  slate: 'text-foreground',
}
const recordSkeletonKeys = ['record-a', 'record-b', 'record-c', 'record-d']

function ReferralStatCard(props: ReferralStatCardProps) {
  const Icon = props.icon

  return (
    <div className='rounded-lg border px-3 py-3 sm:px-5 sm:py-4'>
      <div className='flex items-center gap-2'>
        <Icon className='text-muted-foreground/60 size-3.5 shrink-0' />
        <div className='text-muted-foreground truncate text-xs font-medium tracking-wider uppercase'>
          {props.label}
        </div>
      </div>
      {props.loading ? (
        <Skeleton className='mt-2 h-7 w-24' />
      ) : (
        <div
          className={cn(
            'mt-1.5 truncate font-mono text-lg font-bold tracking-tight tabular-nums sm:mt-2 sm:text-2xl',
            statToneClassNames[props.tone]
          )}
        >
          {props.value}
        </div>
      )}
      {props.description ? (
        <p className='text-muted-foreground/60 mt-1 hidden text-xs md:block'>
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
        <Skeleton className='h-3.5 w-28' />
        <Skeleton className='h-9 w-full' />
      </div>
    )
  }

  return (
    <div className='min-w-0 space-y-2'>
      <Label
        htmlFor={props.id}
        className='text-muted-foreground text-xs font-medium tracking-wider uppercase'
      >
        {props.label}
      </Label>
      <div className='flex min-w-0 items-center gap-2'>
        <Input
          id={props.id}
          value={props.value}
          readOnly
          className='h-9 min-w-0 flex-1 font-mono text-sm'
        />
        <CopyButton
          value={props.value}
          variant='outline'
          className='size-9 shrink-0'
          iconClassName='size-4'
          tooltip={props.tooltip}
          aria-label={props.tooltip}
        />
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
      <div className='rounded-lg border'>
        <Table className='min-w-[760px]'>
          <TableHeader>
            <TableRow className='bg-muted/40 hover:bg-muted/40'>
              <TableHead className='px-4'>{t('User ID')}</TableHead>
              <TableHead>{t('Created At')}</TableHead>
              <TableHead>{t('Topup Amount')}</TableHead>
              <TableHead>{t('Commission')}</TableHead>
              <TableHead>{t('Rate')}</TableHead>
              <TableHead className='px-4'>{t('Payment Method')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recordSkeletonKeys.map((key) => (
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
  }

  if (props.records.length === 0) {
    return (
      <div className='text-muted-foreground flex min-h-28 flex-col items-center justify-center rounded-lg border border-dashed px-4 py-8 text-center'>
        <p className='text-sm font-medium'>{t('No referral records found')}</p>
        <p className='mt-1 text-xs'>
          {props.keyword
            ? t('Try adjusting your search')
            : t('Invited user top-ups will appear here')}
        </p>
      </div>
    )
  }

  return (
    <div className='rounded-lg border'>
      <Table className='min-w-[760px]'>
        <TableHeader>
          <TableRow className='bg-muted/40 hover:bg-muted/40'>
            <TableHead className='px-4'>{t('User ID')}</TableHead>
            <TableHead>{t('Created At')}</TableHead>
            <TableHead>{t('Topup Amount')}</TableHead>
            <TableHead>{t('Commission')}</TableHead>
            <TableHead>{t('Rate')}</TableHead>
            <TableHead className='px-4'>{t('Payment Method')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.records.map((record) => (
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
        <SectionPageLayout.Title>
          {t('Referral Program')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <div className='mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-5'>
            <div className='grid gap-3 sm:gap-4 lg:grid-cols-4'>
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

            <TitledCard
              title={t('Invite Rewards')}
              description={t(
                'Invite new users and transfer earned rewards to your account balance.'
              )}
              icon={<Gift className='h-4 w-4' />}
              disableHoverEffect
              contentClassName='space-y-4 sm:space-y-6'
            >
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

              <div className='bg-muted/40 rounded-lg border p-4 sm:p-5'>
                <h4 className='text-sm font-semibold'>{t('How it works')}</h4>
                <ol className='text-muted-foreground mt-3 space-y-2 text-sm leading-6'>
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
            </TitledCard>

            <TitledCard
              title={t('Transfer Rewards to Balance')}
              description={t(
                'Move all available rewards into your account balance.'
              )}
              icon={<ArrowRightLeft className='h-4 w-4' />}
              disableHoverEffect
              action={
                <Button
                  onClick={() => setTransferDialogOpen(true)}
                  disabled={!hasRewards || !complianceConfirmed}
                  className='w-full gap-2 sm:w-auto'
                >
                  <ArrowRightLeft className='size-4' />
                  {t('Transfer to Balance')}
                </Button>
              }
            >
              <p
                className={cn(
                  'text-sm font-semibold',
                  hasRewards ? 'text-success' : 'text-warning'
                )}
              >
                {hasRewards
                  ? formatQuota(availableQuota)
                  : t('No transferable rewards')}
              </p>
              {!complianceConfirmed ? (
                <p className='text-muted-foreground mt-2 text-xs'>
                  {t(
                    'Referral reward transfer is disabled until the administrator confirms compliance terms.'
                  )}
                </p>
              ) : null}
            </TitledCard>

            <TitledCard
              title={t('Invited Users')}
              icon={<Users className='h-4 w-4' />}
              disableHoverEffect
              action={
                <div className='relative w-full sm:w-80'>
                  <Search className='text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2' />
                  <Input
                    aria-label={t('Search')}
                    placeholder={t('Search user IDs or orders...')}
                    value={keyword}
                    onChange={(event) => handleSearch(event.target.value)}
                    className='h-9 pl-10'
                  />
                </div>
              }
              contentClassName='space-y-4'
            >
              <ReferralRecordList
                records={records}
                loading={recordsLoading}
                keyword={keyword}
              />

              {!recordsLoading && total > 0 ? (
                <div className='flex flex-col items-center gap-3 border-t pt-4 sm:flex-row sm:justify-between'>
                  <div className='text-muted-foreground text-xs sm:text-sm'>
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
                    >
                      <ChevronLeft className='size-4' />
                    </Button>
                    <div className='text-muted-foreground min-w-14 text-center text-sm'>
                      <span className='text-foreground font-semibold'>
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
                    >
                      <ChevronRight className='size-4' />
                    </Button>
                  </div>
                </div>
              ) : null}
            </TitledCard>
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
