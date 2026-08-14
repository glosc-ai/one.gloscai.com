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
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpDown, Copy, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Markdown } from '@/components/ui/markdown'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { CopyButton } from '@/components/copy-button'
import {
  createAdminAPIKey,
  deleteAdminAPIKey,
  getAdminAPIKeys,
  updateAdminAPIKey,
} from '../api'
import { SettingsControlGroup } from '../components/settings-form-layout'
import { SettingsSection } from '../components/settings-section'
import type {
  AdminAPIKey,
  AdminAPIKeyPayload,
  AdminAPIKeyScope,
} from '../types'

const ADMIN_API_SCOPES: Array<{
  scope: AdminAPIKeyScope
  label: string
  endpoint: string
}> = [
  {
    scope: 'users',
    label: 'Registered users',
    endpoint: '/api/admin-api/users',
  },
  {
    scope: 'payments',
    label: 'Payment logs',
    endpoint: '/api/admin-api/payments',
  },
  {
    scope: 'usage_logs',
    label: 'Usage logs',
    endpoint: '/api/admin-api/usage-logs',
  },
  { scope: 'models', label: 'Models', endpoint: '/api/admin-api/models' },
  {
    scope: 'model_call_logs',
    label: 'Model call logs',
    endpoint: '/api/admin-api/model-call-logs',
  },
]

const emptyForm: AdminAPIKeyPayload = {
  name: '',
  scopes: ['users'],
  status: 1,
  expired_at: 0,
  description: '',
}

const ADMIN_API_CREATED_KEY_STORAGE = 'admin-api-created-key'

type CreatedAdminAPIKey = {
  id: number
  value: string
}

async function getAdminAPIDocs() {
  const res = await fetch('/docs/api.md', {
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error('Failed to load API documentation')
  }
  return res.text()
}

function getStoredCreatedKey(): CreatedAdminAPIKey | null {
  try {
    const raw = window.sessionStorage.getItem(ADMIN_API_CREATED_KEY_STORAGE)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CreatedAdminAPIKey
    if (!parsed.id || !parsed.value) return null
    return parsed
  } catch {
    return null
  }
}

function setStoredCreatedKey(key: CreatedAdminAPIKey | null) {
  try {
    if (!key) {
      window.sessionStorage.removeItem(ADMIN_API_CREATED_KEY_STORAGE)
      return
    }
    window.sessionStorage.setItem(
      ADMIN_API_CREATED_KEY_STORAGE,
      JSON.stringify(key)
    )
  } catch {
    // Ignore storage failures; the key is still available in memory.
  }
}

function toDateInputValue(timestamp: number) {
  if (!timestamp) return ''
  return new Date(timestamp * 1000).toISOString().slice(0, 10)
}

function fromDateInputValue(value: string) {
  if (!value) return 0
  return Math.floor(new Date(`${value}T23:59:59`).getTime() / 1000)
}

function maskAdminAPIKey(
  item: AdminAPIKey,
  createdKey: CreatedAdminAPIKey | null
) {
  if (createdKey?.id === item.id) {
    const value = createdKey.value
    if (value.length <= 16) return value
    return `${value.slice(0, 8)}${'*'.repeat(12)}${value.slice(-4)}`
  }
  return `${item.key_prefix}${'*'.repeat(12)}`
}

type KeyDialogProps = {
  open: boolean
  item: AdminAPIKey | null
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: AdminAPIKeyPayload) => Promise<void>
  isSaving: boolean
}

function KeyDialog({
  open,
  item,
  onOpenChange,
  onSubmit,
  isSaving,
}: KeyDialogProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<AdminAPIKeyPayload>(() =>
    item
      ? {
          name: item.name,
          scopes: item.scope_list,
          status: item.status,
          expired_at: item.expired_at,
          description: item.description ?? '',
        }
      : emptyForm
  )

  const toggleScope = (scope: AdminAPIKeyScope, checked: boolean) => {
    setForm((current) => {
      const scopes = checked
        ? [...current.scopes, scope]
        : current.scopes.filter((item) => item !== scope)
      return { ...current, scopes: [...new Set(scopes)] }
    })
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error(t('Name is required'))
      return
    }
    if (form.scopes.length === 0) {
      toast.error(t('Select at least one API permission.'))
      return
    }
    await onSubmit({ ...form, name: form.name.trim() })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='grid max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-lg'>
        <DialogHeader className='px-4 pt-4 pb-3'>
          <DialogTitle>
            {item ? t('Edit admin API key') : t('Create admin API key')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'Grant this key access only to the data endpoints it should read.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className='grid min-h-0 gap-4 overflow-y-auto px-4 py-1'>
          <div className='grid gap-2'>
            <Label htmlFor='admin-api-key-name'>{t('Name')}</Label>
            <Input
              id='admin-api-key-name'
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
            />
          </div>

          <div className='grid gap-2'>
            <Label>{t('Permissions')}</Label>
            <div className='divide-border divide-y overflow-hidden rounded-lg border'>
              {ADMIN_API_SCOPES.map((item) => (
                <label
                  key={item.scope}
                  className='hover:bg-muted/40 flex items-center gap-3 px-3 py-2.5'
                >
                  <Checkbox
                    checked={form.scopes.includes(item.scope)}
                    onCheckedChange={(checked) =>
                      toggleScope(item.scope, checked === true)
                    }
                  />
                  <span className='text-sm font-medium'>{t(item.label)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className='flex items-center justify-between gap-4'>
            <div>
              <Label>{t('Enabled')}</Label>
              <p className='text-muted-foreground text-xs'>
                {t('Disabled keys cannot access admin API endpoints.')}
              </p>
            </div>
            <Switch
              checked={form.status === 1}
              onCheckedChange={(checked) =>
                setForm((current) => ({
                  ...current,
                  status: checked ? 1 : 2,
                }))
              }
            />
          </div>

          <div className='grid gap-2'>
            <Label htmlFor='admin-api-key-expiry'>{t('Expires at')}</Label>
            <Input
              id='admin-api-key-expiry'
              type='date'
              value={toDateInputValue(form.expired_at)}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  expired_at: fromDateInputValue(event.target.value),
                }))
              }
            />
          </div>

          <div className='grid gap-2'>
            <Label htmlFor='admin-api-key-description'>
              {t('Description')}
            </Label>
            <Textarea
              id='admin-api-key-description'
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </div>
        </div>

        <DialogFooter showCloseButton className='mx-0 mb-0'>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? t('Saving...') : t('Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AdminAPISection() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<AdminAPIKey | null>(null)
  const [createdKey, setCreatedKey] = useState<CreatedAdminAPIKey | null>(() =>
    getStoredCreatedKey()
  )

  const keysQuery = useQuery({
    queryKey: ['admin-api-keys'],
    queryFn: getAdminAPIKeys,
  })

  const docsQuery = useQuery({
    queryKey: ['admin-api-docs'],
    queryFn: getAdminAPIDocs,
  })

  const saveMutation = useMutation({
    mutationFn: async (payload: AdminAPIKeyPayload) => {
      if (editingKey) {
        return updateAdminAPIKey(editingKey.id, payload)
      }
      const res = await createAdminAPIKey(payload)
      if (res.data?.key && res.data.item?.id) {
        const nextCreatedKey = {
          id: res.data.item.id,
          value: res.data.key,
        }
        setCreatedKey(nextCreatedKey)
        setStoredCreatedKey(nextCreatedKey)
      }
      return res
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-api-keys'] })
      setDialogOpen(false)
      setEditingKey(null)
      toast.success(t('Saved successfully'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAdminAPIKey,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-api-keys'] })
      toast.success(t('Deleted successfully'))
    },
  })

  const keys = keysQuery.data?.data ?? []

  const openCreateDialog = () => {
    setEditingKey(null)
    setDialogOpen(true)
  }

  const openEditDialog = (item: AdminAPIKey) => {
    setEditingKey(item)
    setDialogOpen(true)
  }

  const handleDelete = (item: AdminAPIKey) => {
    if (!window.confirm(t('Delete this admin API key?'))) return
    if (createdKey?.id === item.id) {
      setCreatedKey(null)
      setStoredCreatedKey(null)
    }
    deleteMutation.mutate(item.id)
  }

  return (
    <SettingsSection
      title={t('Admin API')}
      description={t(
        'Create keys for external systems to read users, payments, usage logs, models, and model call logs.'
      )}
    >
      {createdKey && (
        <Alert>
          <AlertTitle>{t('Copy this key now')}</AlertTitle>
          <AlertDescription className='flex min-w-0 items-center gap-2'>
            <code className='bg-muted min-w-0 flex-1 rounded px-2 py-1 font-mono text-xs break-all'>
              {createdKey.value}
            </code>
            <CopyButton
              value={createdKey.value}
              variant='outline'
              size='sm'
              tooltip={t('Copy admin API key')}
              successTooltip={t('Copied!')}
            >
              {t('Copy API key')}
            </CopyButton>
          </AlertDescription>
        </Alert>
      )}

      <SettingsControlGroup className='space-y-4'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div>
            <h4 className='text-sm font-medium'>{t('API keys')}</h4>
            <p className='text-muted-foreground text-sm'>
              {t('Use Bearer auth or X-Admin-Api-Key to call these endpoints.')}
            </p>
          </div>
          <Button onClick={openCreateDialog} size='sm'>
            <Plus />
            {t('Create key')}
          </Button>
        </div>

        <div className='overflow-x-auto rounded-lg border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-10'>
                  <span className='border-border block size-4 rounded-full border' />
                </TableHead>
                <TableHead className='min-w-36'>
                  <span className='flex items-center gap-2'>
                    {t('Name')}
                    <ArrowUpDown className='text-muted-foreground size-4' />
                  </span>
                </TableHead>
                <TableHead className='min-w-32'>
                  <span className='flex items-center gap-2'>
                    {t('Status')}
                    <ArrowUpDown className='text-muted-foreground size-4' />
                  </span>
                </TableHead>
                <TableHead className='min-w-80'>{t('API key')}</TableHead>
                <TableHead className='w-24 text-right'>
                  {t('Actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className='text-muted-foreground h-24 text-center'
                  >
                    {keysQuery.isLoading
                      ? t('Loading...')
                      : t('No admin API keys yet.')}
                  </TableCell>
                </TableRow>
              )}
              {keys.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <span className='border-border bg-muted/40 block size-4 rounded-full border' />
                  </TableCell>
                  <TableCell className='text-base font-semibold'>
                    {item.name}
                  </TableCell>
                  <TableCell>
                    <div className='flex items-center gap-2 font-medium'>
                      <span
                        className={
                          item.status === 1
                            ? 'block size-1.5 rounded-full bg-emerald-500'
                            : 'bg-muted-foreground block size-1.5 rounded-full'
                        }
                      />
                      <span
                        className={
                          item.status === 1
                            ? 'text-emerald-500'
                            : 'text-muted-foreground'
                        }
                      >
                        {item.status === 1 ? t('Enabled') : t('Disabled')}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className='flex min-w-0 items-center gap-3'>
                      <span className='text-muted-foreground font-mono text-sm font-semibold tracking-wide'>
                        {maskAdminAPIKey(item, createdKey)}
                      </span>
                      {createdKey?.id === item.id ? (
                        <CopyButton
                          value={createdKey.value}
                          size='icon'
                          tooltip={t('Copy admin API key')}
                          successTooltip={t('Copied!')}
                          aria-label={t('Copy API key')}
                        />
                      ) : (
                        <Button
                          variant='ghost'
                          size='icon-sm'
                          disabled
                          aria-label={t('Copy API key')}
                        >
                          <Copy />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className='flex justify-end gap-2'>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => openEditDialog(item)}
                      >
                        {t('Edit')}
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon-sm'
                        onClick={() => handleDelete(item)}
                        aria-label={t('Delete')}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SettingsControlGroup>

      <SettingsControlGroup>
        <h4 className='text-sm font-medium'>{t('Available data endpoints')}</h4>
        <div className='grid gap-2'>
          {ADMIN_API_SCOPES.map((item) => (
            <div
              key={item.scope}
              className='grid gap-1 rounded-lg border p-3 sm:grid-cols-[180px_1fr]'
            >
              <span className='text-sm font-medium'>{t(item.label)}</span>
              <code className='text-muted-foreground font-mono text-xs break-all'>
                {item.endpoint}
                ?p=1&page_size=100&start_timestamp=...&end_timestamp=...&sort_by=id&sort_order=desc
              </code>
            </div>
          ))}
        </div>
      </SettingsControlGroup>

      <SettingsControlGroup className='space-y-4'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <h4 className='text-sm font-medium'>{t('Usage documentation')}</h4>
            <p className='text-muted-foreground text-sm'>
              {t('Loaded from web/default/public/docs/api.md.')}
            </p>
          </div>
          {docsQuery.data && (
            <CopyButton
              value={docsQuery.data}
              variant='outline'
              size='sm'
              tooltip={t('Copy documentation as Markdown')}
              successTooltip={t('Copied!')}
            >
              {t('Copy Markdown')}
            </CopyButton>
          )}
        </div>
        {docsQuery.isLoading ? (
          <p className='text-muted-foreground text-sm'>{t('Loading...')}</p>
        ) : docsQuery.isError ? (
          <p className='text-destructive text-sm'>
            {t('Failed to load API documentation')}
          </p>
        ) : (
          <div className='bg-background/40 min-w-0 overflow-x-auto rounded-md p-4'>
            <Markdown className='prose-sm text-foreground prose-headings:text-foreground prose-headings:mt-5 prose-headings:mb-2 prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:my-2 prose-p:leading-7 prose-ul:list-disc prose-ol:list-decimal prose-li:my-0.5 prose-li:pl-0 prose-code:text-foreground prose-code:text-[0.9em] prose-pre:max-w-full prose-pre:overflow-x-auto prose-pre:text-xs prose-table:text-sm'>
              {docsQuery.data ?? ''}
            </Markdown>
          </div>
        )}
      </SettingsControlGroup>

      {dialogOpen && (
        <KeyDialog
          key={editingKey?.id ?? 'new'}
          open={dialogOpen}
          item={editingKey}
          onOpenChange={setDialogOpen}
          onSubmit={async (payload) => {
            await saveMutation.mutateAsync(payload)
          }}
          isSaving={saveMutation.isPending}
        />
      )}
    </SettingsSection>
  )
}
