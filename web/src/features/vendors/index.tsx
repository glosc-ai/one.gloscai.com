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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Pencil,
  Plus,
  Power,
  PowerOff,
  RotateCcw,
  Search,
  Trash2,
  WandSparkles,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { SectionPageLayout } from '@/components/layout'
import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  modelsQueryKeys,
  vendorsQueryKeys,
} from '@/features/models/lib/query-keys'
import { getLobeIcon } from '@/lib/lobe-icon'

import {
  autoAddVendors,
  batchDeleteVendors,
  batchUpdateVendorStatus,
  deleteVendor,
  getVendors,
  removeUnusedVendors,
  searchVendors,
} from './api'
import { AutoAddVendorsDialog } from './components/auto-add-vendors-dialog'
import { VendorMutateDialog } from './components/vendor-mutate-dialog'
import { vendorsPageQueryKeys } from './lib'
import type { Vendor } from './types'
import { loadLobeVendorCatalog } from './vendor-catalog'

const PAGE_SIZE = 20

function formatTime(value: number) {
  if (!value) return '-'
  return new Date(value * 1000).toLocaleString()
}

export function Vendors() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [submittedKeyword, setSubmittedKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | '0' | '1'>('all')
  const [iconFilter, setIconFilter] = useState<'all' | 'with' | 'without'>(
    'all'
  )
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [mutateOpen, setMutateOpen] = useState(false)
  const [currentVendor, setCurrentVendor] = useState<Vendor | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [removeUnusedOpen, setRemoveUnusedOpen] = useState(false)
  const [autoAddOpen, setAutoAddOpen] = useState(false)

  const params = useMemo(() => {
    let hasIcon: boolean | undefined
    if (iconFilter === 'with') hasIcon = true
    if (iconFilter === 'without') hasIcon = false

    return {
      p: page,
      page_size: PAGE_SIZE,
      keyword: submittedKeyword || undefined,
      status:
        statusFilter === 'all' ? undefined : (Number(statusFilter) as 0 | 1),
      has_icon: hasIcon,
    }
  }, [iconFilter, page, statusFilter, submittedKeyword])

  const query = useQuery({
    queryKey: vendorsPageQueryKeys.list(params),
    queryFn: () =>
      submittedKeyword ? searchVendors(params) : getVendors(params),
  })

  const items = query.data?.data?.items ?? []
  const total = query.data?.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const allPageSelected =
    items.length > 0 && items.every((vendor) => selectedIds.has(vendor.id))
  const somePageSelected =
    !allPageSelected && items.some((vendor) => selectedIds.has(vendor.id))

  const clearSelection = () => setSelectedIds(new Set())

  const invalidateVendorData = () => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: vendorsPageQueryKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: vendorsQueryKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: modelsQueryKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: ['pricing'] }),
    ])
  }

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteVendor(id),
    onSuccess: (res, deletedVendorID) => {
      if (!res.success) {
        toast.error(res.message || t('Failed to delete vendor'))
        return
      }
      toast.success(t('Vendor deleted successfully'))
      setDeleteTarget(null)
      setSelectedIds((current) => {
        const next = new Set(current)
        next.delete(deletedVendorID)
        return next
      })
      if (items.length === 1 && page > 1) {
        setPage((value) => Math.max(1, value - 1))
      }
      invalidateVendorData()
    },
    onError: (error: unknown) => {
      toast.error((error as Error)?.message || t('Failed to delete vendor'))
    },
  })

  const batchStatusMutation = useMutation({
    mutationFn: batchUpdateVendorStatus,
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.message || t('Operation failed'))
        return
      }
      toast.success(t('Vendor updated successfully'))
      clearSelection()
      invalidateVendorData()
    },
    onError: (error: unknown) => {
      toast.error((error as Error)?.message || t('Operation failed'))
    },
  })

  const batchDeleteMutation = useMutation({
    mutationFn: batchDeleteVendors,
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.message || t('Operation failed'))
        return
      }
      toast.success(t('Vendor deleted successfully'))
      setBulkDeleteOpen(false)
      if (selectedIds.size === items.length && page > 1) {
        setPage((value) => Math.max(1, value - 1))
      }
      clearSelection()
      invalidateVendorData()
    },
    onError: (error: unknown) => {
      toast.error((error as Error)?.message || t('Operation failed'))
    },
  })

  const removeUnusedMutation = useMutation({
    mutationFn: removeUnusedVendors,
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.message || t('Operation failed'))
        return
      }
      const deletedCount = res.data?.deleted_count ?? 0
      setRemoveUnusedOpen(false)
      setPage(1)
      clearSelection()
      invalidateVendorData()
      if (deletedCount === 0) {
        toast.info(t('No unused vendors found.'))
        return
      }
      toast.success(
        t('Removed {{count}} unused vendor(s).', { count: deletedCount })
      )
    },
    onError: (error: unknown) => {
      toast.error((error as Error)?.message || t('Operation failed'))
    },
  })

  const autoAddMutation = useMutation({
    mutationFn: async () => {
      const catalog = await loadLobeVendorCatalog()
      return autoAddVendors({ catalog })
    },
    onSuccess: (res) => {
      if (!res.success || !res.data) {
        toast.error(res.message || t('Failed to automatically add vendors'))
        return
      }

      setAutoAddOpen(false)
      setKeyword('')
      setSubmittedKeyword('')
      setPage(1)
      clearSelection()
      invalidateVendorData()

      if (res.data.created_count === 0) {
        toast.info(
          t(
            'No vendors were added. Namespaces: {{existing}} existing, {{unmatched}} unmatched, {{ambiguous}} ambiguous, {{deletedConflict}} blocked by deleted vendors.',
            {
              ambiguous: res.data.ambiguous_count,
              deletedConflict: res.data.deleted_conflict_count,
              existing: res.data.existing_count,
              unmatched: res.data.unmatched_count,
            }
          )
        )
        return
      }

      toast.success(
        t(
          'Vendor scan complete: {{created}} vendor(s) added. Namespaces: {{existing}} existing, {{unmatched}} unmatched, {{ambiguous}} ambiguous, {{deletedConflict}} blocked by deleted vendors.',
          {
            ambiguous: res.data.ambiguous_count,
            created: res.data.created_count,
            deletedConflict: res.data.deleted_conflict_count,
            existing: res.data.existing_count,
            unmatched: res.data.unmatched_count,
          }
        )
      )
    },
    onError: (error: unknown) => {
      toast.error(
        (error as Error)?.message || t('Failed to automatically add vendors')
      )
    },
  })

  const openCreate = () => {
    setCurrentVendor(null)
    setMutateOpen(true)
  }

  const openEdit = (vendor: Vendor) => {
    setCurrentVendor(vendor)
    setMutateOpen(true)
  }

  const submitSearch = () => {
    setPage(1)
    setSubmittedKeyword(keyword.trim())
    clearSelection()
  }

  const handleStatusFilterChange = (value: string | null) => {
    if (value !== 'all' && value !== '0' && value !== '1') return
    setStatusFilter(value)
    setPage(1)
    clearSelection()
  }

  const handleIconFilterChange = (value: string | null) => {
    if (value !== 'all' && value !== 'with' && value !== 'without') return
    setIconFilter(value)
    setPage(1)
    clearSelection()
  }

  const resetFilters = () => {
    setKeyword('')
    setSubmittedKeyword('')
    setStatusFilter('all')
    setIconFilter('all')
    setPage(1)
    clearSelection()
    void queryClient.invalidateQueries({
      queryKey: vendorsPageQueryKeys.lists(),
    })
  }

  const togglePageSelection = (checked: boolean) => {
    if (!checked) {
      clearSelection()
      return
    }
    setSelectedIds(new Set(items.map((vendor) => vendor.id)))
  }

  const toggleVendorSelection = (vendorID: number, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (checked) next.add(vendorID)
      else next.delete(vendorID)
      return next
    })
  }

  const changePage = (nextPage: number) => {
    setPage(nextPage)
    clearSelection()
  }

  const bulkActionPending =
    batchStatusMutation.isPending || batchDeleteMutation.isPending

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>
          {t('Vendor Management')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <div className='flex flex-col gap-4'>
            <Card>
              <CardHeader>
                <CardTitle>{t('Vendor Management')}</CardTitle>
              </CardHeader>
              <CardContent className='flex flex-col gap-4'>
                <div className='flex flex-col gap-3'>
                  <div className='grid gap-3 lg:grid-cols-[minmax(0,1fr)_10rem_10rem]'>
                    <Input
                      className='min-w-0'
                      value={keyword}
                      onChange={(event) => setKeyword(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') submitSearch()
                      }}
                      placeholder={t('Search by name, alias or description...')}
                    />
                    <Select
                      items={[
                        { value: 'all', label: t('All Statuses') },
                        { value: '1', label: t('Enabled') },
                        { value: '0', label: t('Disabled') },
                      ]}
                      value={statusFilter}
                      onValueChange={handleStatusFilterChange}
                    >
                      <SelectTrigger
                        className='w-full'
                        aria-label={t('Status')}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>
                          <SelectItem value='all'>
                            {t('All Statuses')}
                          </SelectItem>
                          <SelectItem value='1'>{t('Enabled')}</SelectItem>
                          <SelectItem value='0'>{t('Disabled')}</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <Select
                      items={[
                        { value: 'all', label: t('All icons') },
                        { value: 'with', label: t('With icon') },
                        { value: 'without', label: t('Without icon') },
                      ]}
                      value={iconFilter}
                      onValueChange={handleIconFilterChange}
                    >
                      <SelectTrigger className='w-full' aria-label={t('Icon')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>
                          <SelectItem value='all'>{t('All icons')}</SelectItem>
                          <SelectItem value='with'>{t('With icon')}</SelectItem>
                          <SelectItem value='without'>
                            {t('Without icon')}
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='flex flex-wrap justify-end gap-2'>
                    <Button variant='outline' onClick={submitSearch}>
                      <Search data-icon='inline-start' />
                      {t('Search')}
                    </Button>
                    <Button variant='outline' onClick={resetFilters}>
                      <RotateCcw data-icon='inline-start' />
                      {t('Reset')}
                    </Button>
                    <Button
                      variant='outline'
                      onClick={() => setAutoAddOpen(true)}
                      disabled={autoAddMutation.isPending}
                    >
                      <WandSparkles data-icon='inline-start' />
                      {t('Auto Add Vendors')}
                    </Button>
                    <Button
                      variant='outline'
                      onClick={() => setRemoveUnusedOpen(true)}
                      disabled={removeUnusedMutation.isPending}
                    >
                      <Trash2 data-icon='inline-start' />
                      {t('Remove Unused Vendors')}
                    </Button>
                    <Button onClick={openCreate}>
                      <Plus data-icon='inline-start' />
                      {t('Create Vendor')}
                    </Button>
                  </div>
                </div>

                <div className='overflow-x-auto rounded-md border'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className='w-10'>
                          <Checkbox
                            checked={allPageSelected}
                            indeterminate={somePageSelected}
                            onCheckedChange={(value) =>
                              togglePageSelection(Boolean(value))
                            }
                            aria-label={t('Select all')}
                          />
                        </TableHead>
                        <TableHead className='w-16'>{t('ID')}</TableHead>
                        <TableHead>{t('Vendor Name')}</TableHead>
                        <TableHead>{t('Alias')}</TableHead>
                        <TableHead className='hidden lg:table-cell'>
                          {t('Description')}
                        </TableHead>
                        <TableHead className='w-20'>{t('Icon')}</TableHead>
                        <TableHead className='w-24'>{t('Status')}</TableHead>
                        <TableHead className='hidden md:table-cell'>
                          {t('Updated')}
                        </TableHead>
                        <TableHead className='bg-card sticky right-0 z-10 w-24 border-l'>
                          {t('Actions')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((vendor) => (
                        <TableRow
                          key={vendor.id}
                          data-state={
                            selectedIds.has(vendor.id) ? 'selected' : undefined
                          }
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(vendor.id)}
                              onCheckedChange={(value) =>
                                toggleVendorSelection(vendor.id, Boolean(value))
                              }
                              aria-label={t('Select row')}
                            />
                          </TableCell>
                          <TableCell>{vendor.id}</TableCell>
                          <TableCell className='font-medium'>
                            {vendor.name}
                          </TableCell>
                          <TableCell>
                            {vendor.alias ? (
                              <Badge variant='secondary'>{vendor.alias}</Badge>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell className='hidden max-w-80 truncate lg:table-cell'>
                            {vendor.description || '-'}
                          </TableCell>
                          <TableCell>
                            {vendor.icon ? (
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <span
                                      className='flex size-8 cursor-help items-center justify-center'
                                      aria-label={`${t('Icon')}: ${vendor.icon}`}
                                    />
                                  }
                                >
                                  {getLobeIcon(vendor.icon, 24)}
                                </TooltipTrigger>
                                <TooltipContent>{vendor.icon}</TooltipContent>
                              </Tooltip>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            <StatusBadge
                              label={
                                vendor.status === 1
                                  ? t('Enabled')
                                  : t('Disabled')
                              }
                              variant={
                                vendor.status === 1 ? 'success' : 'neutral'
                              }
                              copyable={false}
                            />
                          </TableCell>
                          <TableCell className='hidden md:table-cell'>
                            {formatTime(vendor.updated_time)}
                          </TableCell>
                          <TableCell className='bg-card group-data-[state=selected]:bg-muted group-hover:bg-muted/50 sticky right-0 z-10 border-l'>
                            <div className='flex items-center gap-1'>
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <Button
                                      type='button'
                                      variant='ghost'
                                      size='icon'
                                      aria-label={t('Edit Vendor')}
                                      onClick={() => openEdit(vendor)}
                                    />
                                  }
                                >
                                  <Pencil />
                                </TooltipTrigger>
                                <TooltipContent>{t('Edit')}</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <Button
                                      type='button'
                                      variant='ghost'
                                      size='icon'
                                      aria-label={t('Delete Vendor')}
                                      onClick={() => setDeleteTarget(vendor)}
                                    />
                                  }
                                >
                                  <Trash2 />
                                </TooltipTrigger>
                                <TooltipContent>{t('Delete')}</TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!query.isLoading && items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className='h-24 text-center'>
                            {t('No data')}
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>

                <div className='flex items-center justify-end gap-2'>
                  <Button
                    variant='outline'
                    disabled={page <= 1}
                    onClick={() => changePage(Math.max(1, page - 1))}
                  >
                    {t('Previous')}
                  </Button>
                  <span className='text-muted-foreground text-sm'>
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant='outline'
                    disabled={page >= totalPages}
                    onClick={() => changePage(Math.min(totalPages, page + 1))}
                  >
                    {t('Next')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      {selectedIds.size > 0 && (
        <div className='fixed bottom-6 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2'>
          <div className='bg-background/95 flex items-center gap-2 overflow-x-auto rounded-lg border p-2 shadow-xl backdrop-blur'>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type='button'
                    variant='outline'
                    size='icon'
                    className='size-8 shrink-0'
                    onClick={clearSelection}
                    disabled={bulkActionPending}
                    aria-label={t('Clear selection')}
                  />
                }
              >
                <X />
              </TooltipTrigger>
              <TooltipContent>{t('Clear selection')}</TooltipContent>
            </Tooltip>

            <div className='flex shrink-0 items-center gap-1.5 text-sm'>
              <Badge className='min-w-8 justify-center'>
                {selectedIds.size}
              </Badge>
              <span>{t('selected')}</span>
            </div>

            <div className='bg-border h-6 w-px shrink-0' aria-hidden='true' />

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type='button'
                    variant='outline'
                    size='icon'
                    className='size-8 shrink-0'
                    onClick={() =>
                      batchStatusMutation.mutate({
                        ids: [...selectedIds],
                        status: 1,
                      })
                    }
                    disabled={bulkActionPending}
                    aria-label={t('Enable selected vendors')}
                  />
                }
              >
                <Power />
              </TooltipTrigger>
              <TooltipContent>{t('Enable selected vendors')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type='button'
                    variant='outline'
                    size='icon'
                    className='size-8 shrink-0'
                    onClick={() =>
                      batchStatusMutation.mutate({
                        ids: [...selectedIds],
                        status: 0,
                      })
                    }
                    disabled={bulkActionPending}
                    aria-label={t('Disable selected vendors')}
                  />
                }
              >
                <PowerOff />
              </TooltipTrigger>
              <TooltipContent>{t('Disable selected vendors')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type='button'
                    variant='destructive'
                    size='icon'
                    className='size-8 shrink-0'
                    onClick={() => setBulkDeleteOpen(true)}
                    disabled={bulkActionPending}
                    aria-label={t('Delete selected vendors')}
                  />
                }
              >
                <Trash2 />
              </TooltipTrigger>
              <TooltipContent>{t('Delete selected vendors')}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}

      <VendorMutateDialog
        open={mutateOpen}
        onOpenChange={setMutateOpen}
        onSuccess={() => {
          clearSelection()
          invalidateVendorData()
        }}
        currentVendor={currentVendor}
      />

      <AutoAddVendorsDialog
        open={autoAddOpen}
        onOpenChange={(open) => {
          if (!autoAddMutation.isPending) setAutoAddOpen(open)
        }}
        onConfirm={() => autoAddMutation.mutate()}
        isLoading={autoAddMutation.isPending}
      />

      <ConfirmDialog
        open={removeUnusedOpen}
        onOpenChange={(open) => {
          if (!removeUnusedMutation.isPending) setRemoveUnusedOpen(open)
        }}
        title={t('Remove Unused Vendors')}
        desc={t(
          'Remove all vendors that are not referenced by any model? This action cannot be undone.'
        )}
        destructive
        isLoading={removeUnusedMutation.isPending}
        handleConfirm={() => removeUnusedMutation.mutate()}
        confirmText={t('Remove')}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => {
          if (!batchDeleteMutation.isPending) setBulkDeleteOpen(open)
        }}
        title={t('Delete selected vendors')}
        desc={t(
          'Are you sure you want to delete {{count}} selected vendor(s)? Vendors referenced by models cannot be deleted.',
          { count: selectedIds.size }
        )}
        destructive
        isLoading={batchDeleteMutation.isPending}
        handleConfirm={() => batchDeleteMutation.mutate([...selectedIds])}
        confirmText={t('Delete')}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('Delete Vendor')}
        desc={t(
          'Are you sure you want to delete vendor "{{name}}"? This action cannot be undone.',
          { name: deleteTarget?.name }
        )}
        destructive
        isLoading={deleteMutation.isPending}
        handleConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
        }}
        confirmText={t('Delete')}
      />
    </>
  )
}
