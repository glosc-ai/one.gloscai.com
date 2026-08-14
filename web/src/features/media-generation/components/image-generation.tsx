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
import { useMutation } from '@tanstack/react-query'
import { Clock, ImageIcon, RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatDateTimeObject } from '@/lib/time'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
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
import { generateImage } from '../api'
import {
  clearImageHistory,
  createImageHistoryItem,
  getImageHistory,
  saveImageHistoryItem,
} from '../history'
import { useMediaModels } from '../hooks/use-media-models'
import type {
  ImageGenerationHistoryItem,
  ImageGenerationResult,
} from '../types'
import { ReferenceImageField } from './reference-image-field'

const SIZE_OPTIONS = ['1024x1024', '1024x1792', '1792x1024', '512x512']
const QUALITY_OPTIONS = ['standard', 'hd']
const COUNT_OPTIONS = ['1', '2', '3', '4']

function resolveImageSrc(item: ImageGenerationResult): string {
  if (item.url) return item.url
  if (item.b64_json) return `data:image/png;base64,${item.b64_json}`
  return ''
}

export function ImageGeneration() {
  const { t } = useTranslation()
  const { models, groups, isLoadingModels } = useMediaModels('image')

  const [model, setModel] = useState('')
  const [group, setGroup] = useState('default')
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState('1024x1024')
  const [quality, setQuality] = useState('standard')
  const [count, setCount] = useState('1')
  const [referenceImage, setReferenceImage] = useState('')
  const [results, setResults] = useState<ImageGenerationResult[]>([])
  const [history, setHistory] =
    useState<ImageGenerationHistoryItem[]>(getImageHistory)

  const selectedModel = model || models[0]?.value || ''
  const selectedGroup =
    groups.length > 0 && !groups.some((g) => g.value === group)
      ? (groups.find((g) => g.value === 'default')?.value ?? groups[0].value)
      : group

  const mutation = useMutation({
    mutationFn: generateImage,
    onSuccess: (data) => {
      if (data.length === 0) {
        toast.error(t('No image was returned'))
        return
      }
      setResults(data)
      const historyItem = createImageHistoryItem({
        model: selectedModel,
        group: selectedGroup,
        prompt: prompt.trim(),
        size,
        quality,
        referenceImage: referenceImage.trim() || undefined,
        results: data,
      })
      setHistory(saveImageHistoryItem(historyItem))
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t('Failed to generate image')
      )
    },
  })

  const handleGenerate = () => {
    if (!selectedModel) {
      toast.error(t('Please select a model'))
      return
    }
    if (!prompt.trim()) {
      toast.error(t('Please enter a prompt'))
      return
    }
    mutation.mutate({
      model: selectedModel,
      prompt: prompt.trim(),
      group: selectedGroup,
      size,
      quality,
      n: Number.parseInt(count, 10) || 1,
      image: referenceImage.trim() || undefined,
      images: referenceImage.trim() ? [referenceImage.trim()] : undefined,
    })
  }

  const handleRestore = (item: ImageGenerationHistoryItem) => {
    setModel(item.model)
    setGroup(item.group || 'default')
    setPrompt(item.prompt)
    setSize(item.size || '1024x1024')
    setQuality(item.quality || 'standard')
    setReferenceImage(item.referenceImage || '')
    setCount(String(item.results.length || 1))
    setResults(item.results)
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
                rows={5}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t('Describe the image you want to generate')}
              />
            </div>

            <ReferenceImageField
              value={referenceImage}
              onChange={setReferenceImage}
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
                <Label>{t('Quality')}</Label>
                <Select
                  value={quality}
                  onValueChange={(v) => v && setQuality(v)}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue>{t(quality)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {QUALITY_OPTIONS.map((q) => (
                        <SelectItem key={q} value={q}>
                          {t(q)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className='space-y-2'>
              <Label>{t('Number of images')}</Label>
              <Select value={count} onValueChange={(v) => v && setCount(v)}>
                <SelectTrigger className='w-full'>
                  <SelectValue>{count}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {COUNT_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <Button
              className='w-full'
              onClick={handleGenerate}
              disabled={mutation.isPending || isLoadingModels}
            >
              {mutation.isPending ? (
                <Spinner className='mr-2' />
              ) : (
                <Sparkles className='mr-2 h-4 w-4' />
              )}
              {t('Generate')}
            </Button>
          </CardContent>
        </Card>

        <ImageHistory
          history={history}
          onRestore={handleRestore}
          onClear={() => setHistory(clearImageHistory())}
        />
      </div>

      <div className='min-h-[200px]'>
        {results.length === 0 ? (
          <div className='text-muted-foreground flex h-full min-h-[300px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed'>
            <ImageIcon className='h-10 w-10' />
            <p>{t('Generated images will appear here')}</p>
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            {results.map((item, index) => {
              const src = resolveImageSrc(item)
              if (!src) return null
              return (
                <a
                  key={index}
                  href={src}
                  target='_blank'
                  rel='noreferrer'
                  className='group block overflow-hidden rounded-xl border'
                >
                  <img
                    src={src}
                    alt={item.revised_prompt ?? prompt}
                    className='h-auto w-full object-cover transition-transform group-hover:scale-[1.02]'
                  />
                </a>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function ImageHistory({
  history,
  onRestore,
  onClear,
}: {
  history: ImageGenerationHistoryItem[]
  onRestore: (item: ImageGenerationHistoryItem) => void
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
          history.map((item) => {
            const firstImage = item.results.map(resolveImageSrc).find(Boolean)
            return (
              <div key={item.id} className='flex gap-3 rounded-lg border p-2'>
                {firstImage ? (
                  <a
                    href={firstImage}
                    target='_blank'
                    rel='noreferrer'
                    className='bg-muted block size-14 shrink-0 overflow-hidden rounded-md'
                  >
                    <img
                      src={firstImage}
                      alt={item.prompt}
                      className='h-full w-full object-cover'
                    />
                  </a>
                ) : (
                  <div className='bg-muted text-muted-foreground flex size-14 shrink-0 items-center justify-center rounded-md'>
                    <ImageIcon className='h-5 w-5' />
                  </div>
                )}
                <div className='min-w-0 flex-1 space-y-1'>
                  <div className='truncate text-sm font-medium'>
                    {item.prompt}
                  </div>
                  <div className='text-muted-foreground truncate text-xs'>
                    {item.model} · {item.size || '-'} ·{' '}
                    {formatDateTimeObject(new Date(item.createdAt))}
                  </div>
                  <Button
                    variant='outline'
                    size='xs'
                    onClick={() => onRestore(item)}
                  >
                    <RotateCcw />
                    {t('Restore')}
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
