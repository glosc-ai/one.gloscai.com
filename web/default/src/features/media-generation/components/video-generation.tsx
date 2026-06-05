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
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Clapperboard,
  Clock,
  PlayCircle,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatDateTimeObject } from '@/lib/time'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { ModelSelector, GroupSelector } from '@/components/model-group-selector'
import { fetchVideoTask, submitVideoGeneration } from '../api'
import {
  clearVideoHistory,
  createVideoHistoryItem,
  getVideoHistory,
  saveVideoHistoryItem,
} from '../history'
import { useMediaModels } from '../hooks/use-media-models'
import type { VideoGenerationHistoryItem, VideoTaskStatus } from '../types'
import { ReferenceImageField } from './reference-image-field'

const SIZE_OPTIONS = [
  '720x1280',
  '1280x720',
  '1024x1024',
  '1792x1024',
  '1024x1792',
]
const DURATION_OPTIONS = ['4', '5', '6', '8', '10']

function getVideoStatusLabel(
  t: (key: string) => string,
  status: VideoTaskStatus['status']
) {
  switch (status) {
    case 'queued':
      return t('Queued')
    case 'completed':
      return t('Completed')
    case 'failed':
      return t('Failed')
    default:
      return t('In progress')
  }
}

function getVideoStatusBadgeVariant(status: VideoTaskStatus['status']) {
  if (status === 'completed') return 'default'
  if (status === 'failed') return 'destructive'
  return 'secondary'
}

export function VideoGeneration() {
  const { t } = useTranslation()
  const { models, groups, isLoadingModels } = useMediaModels('video')

  const [model, setModel] = useState('')
  const [group, setGroup] = useState('default')
  const [prompt, setPrompt] = useState('')
  const [image, setImage] = useState('')
  const [size, setSize] = useState('720x1280')
  const [seconds, setSeconds] = useState('5')
  const [taskId, setTaskId] = useState('')
  const [submitStatus, setSubmitStatus] = useState<VideoTaskStatus | null>(null)
  const activeHistoryItemRef = useRef<VideoGenerationHistoryItem | null>(null)
  const [history, setHistory] =
    useState<VideoGenerationHistoryItem[]>(getVideoHistory)

  const selectedModel = model || models[0]?.value || ''
  const selectedGroup =
    groups.length > 0 && !groups.some((g) => g.value === group)
      ? (groups.find((g) => g.value === 'default')?.value ?? groups[0].value)
      : group

  const submitMutation = useMutation({
    mutationFn: submitVideoGeneration,
    onSuccess: (data) => {
      setSubmitStatus(data)
      const historyItem = createVideoHistoryItem({
        model: selectedModel,
        group: selectedGroup,
        prompt: prompt.trim(),
        image: image.trim() || undefined,
        size,
        seconds,
        task: data,
      })
      activeHistoryItemRef.current = historyItem
      setHistory(saveVideoHistoryItem(historyItem))
      if (data.taskId) {
        setTaskId(data.taskId)
      } else if (data.status === 'completed' && data.url) {
        // Synchronous completion without a task id.
      } else {
        toast.error(t('Failed to submit video task'))
      }
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t('Failed to generate video')
      )
    },
  })

  const pollQuery = useQuery({
    queryKey: ['video-task', taskId],
    queryFn: () => fetchVideoTask(taskId),
    enabled: Boolean(taskId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'completed' || status === 'failed') return false
      return 3000
    },
  })

  const current: VideoTaskStatus | null = useMemo(() => {
    return pollQuery.data ?? submitStatus
  }, [pollQuery.data, submitStatus])

  useEffect(() => {
    if (current?.status === 'failed') {
      toast.error(current.errorMessage || t('Video generation failed'))
    }
  }, [current?.status, current?.errorMessage, t])

  useEffect(() => {
    const activeHistoryItem = activeHistoryItemRef.current
    if (!current || !activeHistoryItem) return
    const updatedItem = {
      ...activeHistoryItem,
      id: current.taskId || activeHistoryItem.id,
      task: current,
    }
    activeHistoryItemRef.current = updatedItem
    setHistory(saveVideoHistoryItem(updatedItem))
  }, [current])

  const isBusy =
    submitMutation.isPending ||
    (Boolean(taskId) &&
      current?.status !== 'completed' &&
      current?.status !== 'failed')

  const handleGenerate = () => {
    if (!selectedModel) {
      toast.error(t('Please select a model'))
      return
    }
    if (!prompt.trim() && !image.trim()) {
      toast.error(t('Please enter a prompt or provide an image'))
      return
    }
    setTaskId('')
    setSubmitStatus(null)
    activeHistoryItemRef.current = null
    submitMutation.mutate({
      model: selectedModel,
      prompt: prompt.trim(),
      group: selectedGroup,
      image: image.trim() || undefined,
      size,
      seconds,
      duration: Number.parseInt(seconds, 10) || undefined,
    })
  }

  const handleRestore = (item: VideoGenerationHistoryItem) => {
    setModel(item.model)
    setGroup(item.group || 'default')
    setPrompt(item.prompt)
    setImage(item.image || '')
    setSize(item.size || '720x1280')
    setSeconds(item.seconds || '5')
    setSubmitStatus(item.task)
    activeHistoryItemRef.current = item
    if (
      item.task.taskId &&
      (item.task.status === 'queued' || item.task.status === 'in_progress')
    ) {
      setTaskId(item.task.taskId)
    } else {
      setTaskId('')
    }
  }

  return (
    <div className='grid h-full grid-cols-1 gap-4 overflow-auto p-4 lg:grid-cols-[360px_1fr]'>
      <div className='space-y-4'>
        <Card className='h-fit'>
          <CardContent className='space-y-4 p-4'>
            <div className='space-y-2'>
              <Label>{t('Model')}</Label>
              <ModelSelector
                selectedModel={selectedModel}
                models={models}
                onModelChange={setModel}
                disabled={isLoadingModels}
                className='w-full'
              />
            </div>

            <div className='space-y-2'>
              <Label>{t('Group')}</Label>
              <GroupSelector
                selectedGroup={selectedGroup}
                groups={groups}
                onGroupChange={setGroup}
                className='w-full'
              />
            </div>

            <div className='space-y-2'>
              <Label>{t('Prompt')}</Label>
              <Textarea
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t('Describe the video you want to generate')}
              />
            </div>

            <ReferenceImageField
              value={image}
              onChange={setImage}
              label={t('Reference image')}
              optional
            />

            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-2'>
                <Label>{t('Size')}</Label>
                <Select value={size} onValueChange={(v) => v && setSize(v)}>
                  <SelectTrigger className='w-full'>
                    <SelectValue>{size}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {SIZE_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <Label>{t('Duration (seconds)')}</Label>
                <Select
                  value={seconds}
                  onValueChange={(v) => v && setSeconds(v)}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue>{seconds}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {DURATION_OPTIONS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              className='w-full'
              onClick={handleGenerate}
              disabled={isBusy || isLoadingModels}
            >
              {isBusy ? (
                <Spinner className='mr-2' />
              ) : (
                <Sparkles className='mr-2 h-4 w-4' />
              )}
              {t('Generate')}
            </Button>
          </CardContent>
        </Card>

        <VideoHistory
          history={history}
          onRestore={handleRestore}
          onClear={() => setHistory(clearVideoHistory())}
        />
      </div>

      <div className='min-h-[200px]'>
        {!current ? (
          <div className='text-muted-foreground flex h-full min-h-[300px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed'>
            <Clapperboard className='h-10 w-10' />
            <p>{t('Generated video will appear here')}</p>
          </div>
        ) : current.status === 'completed' && current.url ? (
          <div className='space-y-3'>
            <video
              src={current.url}
              controls
              className='w-full rounded-xl border'
            />
            <a
              href={current.url}
              target='_blank'
              rel='noreferrer'
              className='text-primary text-sm underline'
            >
              {t('Open video in new tab')}
            </a>
            <VideoTaskDetails task={current} />
          </div>
        ) : (
          <div className='flex h-full min-h-[300px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-6'>
            {current.status === 'failed' ? (
              <Clapperboard className='text-destructive h-8 w-8' />
            ) : (
              <Spinner className='text-muted-foreground h-8 w-8' />
            )}
            <div className='w-full max-w-md space-y-3'>
              <div className='flex items-center justify-center gap-2'>
                <Badge variant={getVideoStatusBadgeVariant(current.status)}>
                  {getVideoStatusLabel(t, current.status)}
                </Badge>
                {current.rawStatus && (
                  <span className='text-muted-foreground text-xs'>
                    {current.rawStatus}
                  </span>
                )}
              </div>
              <Progress value={current.progress} />
              <p className='text-muted-foreground text-center text-sm'>
                {current.status === 'failed'
                  ? current.errorMessage || t('Video generation failed')
                  : `${t('Generating')}... ${current.progress}%`}
              </p>
              <VideoTaskDetails task={current} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function VideoHistory({
  history,
  onRestore,
  onClear,
}: {
  history: VideoGenerationHistoryItem[]
  onRestore: (item: VideoGenerationHistoryItem) => void
  onClear: () => void
}) {
  const { t } = useTranslation()

  return (
    <Card size='sm'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Clock className='h-4 w-4' />
          {t('History')}
        </CardTitle>
        {history.length > 0 && (
          <CardAction>
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={onClear}
              aria-label={t('Clear history')}
              title={t('Clear history')}
            >
              <Trash2 />
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className='space-y-3'>
        {history.length === 0 ? (
          <p className='text-muted-foreground text-sm'>{t('No history yet')}</p>
        ) : (
          history.map((item) => (
            <div key={item.id} className='space-y-2 rounded-lg border p-3'>
              <div className='flex items-start gap-3'>
                <div className='bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md'>
                  {item.task.status === 'completed' ? (
                    <PlayCircle className='h-5 w-5' />
                  ) : (
                    <Clapperboard className='h-5 w-5' />
                  )}
                </div>
                <div className='min-w-0 flex-1 space-y-1'>
                  <div className='truncate text-sm font-medium'>
                    {item.prompt || item.image || item.task.taskId}
                  </div>
                  <div className='text-muted-foreground truncate text-xs'>
                    {item.task.upstreamModel || item.model} · {item.size || '-'}{' '}
                    · {formatDateTimeObject(new Date(item.updatedAt))}
                  </div>
                </div>
              </div>
              <div className='flex items-center gap-2'>
                <Badge variant={getVideoStatusBadgeVariant(item.task.status)}>
                  {getVideoStatusLabel(t, item.task.status)}
                </Badge>
                <span className='text-muted-foreground text-xs'>
                  {item.task.progress}%
                </span>
              </div>
              {item.task.status !== 'completed' &&
                item.task.status !== 'failed' && (
                  <Progress value={item.task.progress} />
                )}
              <div className='flex flex-wrap gap-2'>
                <Button
                  variant='outline'
                  size='xs'
                  onClick={() => onRestore(item)}
                >
                  <RotateCcw />
                  {item.task.status === 'queued' ||
                  item.task.status === 'in_progress'
                    ? t('Resume')
                    : t('Restore')}
                </Button>
                {item.task.url && (
                  <Button
                    variant='link'
                    size='xs'
                    render={
                      <a
                        href={item.task.url}
                        target='_blank'
                        rel='noreferrer'
                      />
                    }
                  >
                    {t('Open video in new tab')}
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function VideoTaskDetails({ task }: { task: VideoTaskStatus }) {
  const { t } = useTranslation()
  const items = [
    { label: t('Task ID'), value: task.taskId },
    { label: t('Video ID'), value: task.videoId },
    { label: t('Model'), value: task.upstreamModel },
    { label: t('Upstream status'), value: task.upstreamStatus },
    { label: t('Action'), value: task.action },
  ].filter((item) => item.value)

  if (items.length === 0) return null

  return (
    <div className='bg-muted/40 grid gap-2 rounded-lg border p-3 text-xs sm:grid-cols-2'>
      {items.map((item) => (
        <div key={item.label} className='min-w-0'>
          <div className='text-muted-foreground'>{item.label}</div>
          <div className='truncate font-mono'>{item.value}</div>
        </div>
      ))}
    </div>
  )
}
