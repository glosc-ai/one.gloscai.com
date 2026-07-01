import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  addDisabledModel,
  deleteDisabledModel,
  getDisabledModels,
  getEnabledChannelsByModel,
  getEnabledModels,
} from './api'

function formatTime(value: number) {
  if (!value) return '-'
  return new Date(value * 1000).toLocaleString()
}

const EXPIRE_OPTIONS = [
  { label: '10 minutes', value: '600' },
  { label: '30 minutes', value: '1800' },
  { label: '1 hour', value: '3600' },
  { label: '6 hours', value: '21600' },
  { label: '24 hours', value: '86400' },
]

export function DisabledModels() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [modelName, setModelName] = useState('')
  const [channel, setChannel] = useState('')
  const [newModelName, setNewModelName] = useState('')
  const [newChannelId, setNewChannelId] = useState('')
  const [expiresIn, setExpiresIn] = useState('600')
  const [remark, setRemark] = useState('')

  const params = useMemo(
    () => ({
      p: page,
      page_size: 20,
      model_name: modelName || undefined,
      channel: channel || undefined,
      active: true,
    }),
    [channel, modelName, page]
  )

  const query = useQuery({
    queryKey: ['disabled-models', params],
    queryFn: () => getDisabledModels(params),
  })

  const enabledModelsQuery = useQuery({
    queryKey: ['disabled-models-enabled-models'],
    queryFn: getEnabledModels,
  })

  const enabledChannelsQuery = useQuery({
    queryKey: ['disabled-models-enabled-channels', newModelName],
    queryFn: () => getEnabledChannelsByModel(newModelName),
    enabled: Boolean(newModelName),
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['disabled-models'] })

  const addMutation = useMutation({
    mutationFn: addDisabledModel,
    onSuccess: (res) => {
      if (!res.success) return
      toast.success(t('Added successfully'))
      setNewModelName('')
      setNewChannelId('')
      setExpiresIn('600')
      setRemark('')
      invalidate()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteDisabledModel,
    onSuccess: (res) => {
      if (!res.success) return
      toast.success(t('Deleted successfully'))
      invalidate()
    },
  })

  const items = query.data?.data?.items ?? []
  const total = query.data?.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / 20))
  const modelOptions = (enabledModelsQuery.data?.data ?? []).map((model) => ({
    label: model,
    value: model,
  }))
  const channelOptions = (enabledChannelsQuery.data ?? []).map((channel) => ({
    label: `${channel.name} (#${channel.id})`,
    value: String(channel.id),
  }))

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Disabled Models')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='flex flex-col gap-4'>
          <Card>
            <CardHeader>
              <CardTitle>{t('Add')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid gap-3 md:grid-cols-[1fr_1fr_160px_1fr_auto]'>
                <Select
                  items={modelOptions}
                  value={newModelName}
                  onValueChange={(value) => {
                    setNewModelName(value)
                    setNewChannelId('')
                  }}
                >
                  <SelectTrigger className='h-9 w-full'>
                    <SelectValue placeholder={t('Model Name')} />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {modelOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Select
                  items={channelOptions}
                  value={newChannelId}
                  onValueChange={setNewChannelId}
                  disabled={!newModelName}
                >
                  <SelectTrigger className='h-9 w-full'>
                    <SelectValue
                      placeholder={
                        newModelName ? t('Channel') : t('Please select a model')
                      }
                    />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {channelOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Select
                  items={EXPIRE_OPTIONS}
                  value={expiresIn}
                  onValueChange={setExpiresIn}
                >
                  <SelectTrigger className='h-9 w-full'>
                    <SelectValue placeholder={t('Expires')} />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {EXPIRE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {t(option.label)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Input
                  value={remark}
                  onChange={(event) => setRemark(event.target.value)}
                  placeholder={t('Remark')}
                />
                <Button
                  disabled={!newModelName || !newChannelId}
                  onClick={() =>
                    addMutation.mutate({
                      model_name: newModelName,
                      channel_id: Number(newChannelId),
                      expires_in: Number(expiresIn),
                      remark,
                    })
                  }
                >
                  <Plus data-icon='inline-start' />
                  {t('Add')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('Disabled Models')}</CardTitle>
            </CardHeader>
            <CardContent className='flex flex-col gap-4'>
              <div className='grid gap-3 md:grid-cols-[1fr_1fr_auto]'>
                <Input
                  value={modelName}
                  onChange={(event) => {
                    setPage(1)
                    setModelName(event.target.value)
                  }}
                  placeholder={t('Model Name')}
                />
                <Input
                  value={channel}
                  onChange={(event) => {
                    setPage(1)
                    setChannel(event.target.value)
                  }}
                  placeholder={t('Channel')}
                />
                <Button variant='outline' onClick={() => query.refetch()}>
                  <RotateCcw data-icon='inline-start' />
                  {t('Refresh')}
                </Button>
              </div>

              <div className='overflow-x-auto rounded-md border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('Model Name')}</TableHead>
                      <TableHead>{t('Channel')}</TableHead>
                      <TableHead>{t('Created')}</TableHead>
                      <TableHead>{t('Expires at')}</TableHead>
                      <TableHead>{t('Remark')}</TableHead>
                      <TableHead className='w-20'>{t('Actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.model_name}</TableCell>
                        <TableCell>
                          <div className='flex flex-col gap-1'>
                            <span>{item.channel_name || '-'}</span>
                            <Badge variant='secondary'>#{item.channel_id}</Badge>
                          </div>
                        </TableCell>
                        <TableCell>{formatTime(item.created_at)}</TableCell>
                        <TableCell>{formatTime(item.expires_at)}</TableCell>
                        <TableCell className='max-w-80 truncate'>
                          {item.remark || '-'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant='ghost'
                            size='icon'
                            onClick={() => deleteMutation.mutate(item.id)}
                          >
                            <Trash2 />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!query.isLoading && items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className='h-24 text-center'>
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
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  {t('Previous')}
                </Button>
                <span className='text-sm text-muted-foreground'>
                  {page} / {totalPages}
                </span>
                <Button
                  variant='outline'
                  disabled={page >= totalPages}
                  onClick={() =>
                    setPage((value) => Math.min(totalPages, value + 1))
                  }
                >
                  {t('Next')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
