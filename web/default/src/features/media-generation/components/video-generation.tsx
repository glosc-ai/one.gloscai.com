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
  AlertCircle,
  Clapperboard,
  Clock,
  Film,
  Image,
  Link2,
  PlayCircle,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatDateTimeObject } from '@/lib/time'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
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
import type {
  VideoGenerationHistoryItem,
  VideoGenerationRequest,
  VideoTaskStatus,
} from '../types'
import { ReferenceImageField } from './reference-image-field'

type VideoMode = 'text' | 'first-frame' | 'first-last-frame' | 'continuation'

type MediaItem = {
  type: 'first_frame' | 'last_frame' | 'first_clip' | 'driving_audio'
  url: string
}

const MODE_OPTIONS: Array<{
  value: VideoMode
  label: string
  description: string
}> = [
  {
    value: 'text',
    label: 'Text',
    description: 'Prompt only',
  },
  {
    value: 'first-frame',
    label: 'First frame',
    description: 'Image to video',
  },
  {
    value: 'first-last-frame',
    label: 'First + last',
    description: 'Keyframe transition',
  },
  {
    value: 'continuation',
    label: 'Continue',
    description: 'Extend a clip',
  },
]

const RESOLUTION_OPTIONS = ['480P', '720P', '1080P']
const WAN27_RESOLUTION_OPTIONS = ['720P', '1080P']
const RATIO_OPTIONS = ['16:9', '9:16', '1:1', '4:3', '3:4']
const DURATION_OPTIONS = Array.from({ length: 14 }, (_, index) =>
  String(index + 2)
)
const LEGACY_SIZE_OPTIONS = [
  '832*480',
  '480*832',
  '624*624',
  '1280*720',
  '720*1280',
  '960*960',
  '1088*832',
  '832*1088',
  '1920*1080',
  '1080*1920',
  '1440*1440',
]
const STANDARD_SIZE_OPTIONS = [
  '720x1280',
  '1280x720',
  '1024x1024',
  '1792x1024',
  '1024x1792',
]
const ALI_CHANNEL_TYPE = 17 // constant.ChannelTypeAli

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

function includesModelPart(model: string, part: string) {
  return model.toLowerCase().includes(part)
}

function getValidResolution(value: string, options: string[]) {
  return options.includes(value) ? value : options[0]
}

function compactObject<T extends Record<string, unknown>>(
  obj: T,
  keepEmptyStringKeys = new Set<string>()
) {
  return Object.fromEntries(
    Object.entries(obj).filter(([key, value]) => {
      if (value === undefined || value === null) return false
      if (Array.isArray(value)) return value.length > 0
      if (typeof value === 'string') {
        return value.length > 0 || keepEmptyStringKeys.has(key)
      }
      return true
    })
  ) as Partial<T>
}

export function VideoGeneration() {
  const { t } = useTranslation()
  const { models, groups, isLoadingModels } = useMediaModels('video')

  const [mode, setMode] = useState<VideoMode>('text')
  const [model, setModel] = useState('')
  const [group, setGroup] = useState('default')
  const [prompt, setPrompt] = useState('')
  const [firstFrame, setFirstFrame] = useState('')
  const [lastFrame, setLastFrame] = useState('')
  const [firstClip, setFirstClip] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [resolution, setResolution] = useState('720P')
  const [ratio, setRatio] = useState('16:9')
  const [legacySize, setLegacySize] = useState('1280*720')
  const [standardSize, setStandardSize] = useState('1280x720')
  const [duration, setDuration] = useState('5')
  const [promptExtend, setPromptExtend] = useState(true)
  const [watermark, setWatermark] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [shotType, setShotType] = useState('auto')
  const [seed, setSeed] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [template, setTemplate] = useState('')
  const [taskId, setTaskId] = useState('')
  const [submitStatus, setSubmitStatus] = useState<VideoTaskStatus | null>(null)
  const activeHistoryItemRef = useRef<VideoGenerationHistoryItem | null>(null)
  const [history, setHistory] =
    useState<VideoGenerationHistoryItem[]>(getVideoHistory)

  const selectedModel = model || models[0]?.value || ''
  const selectedModelInfo = models.find((item) => item.value === selectedModel)
  const selectedGroup =
    groups.length > 0 && !groups.some((g) => g.value === group)
      ? (groups.find((g) => g.value === 'default')?.value ?? groups[0].value)
      : group
  const selectedChannelType =
    selectedModelInfo?.channel_types_by_group?.[selectedGroup] ??
    selectedModelInfo?.channel_type

  const isAliModel = selectedChannelType === ALI_CHANNEL_TYPE
  const isWan27 = includesModelPart(selectedModel, 'wan2.7')
  const isT2VModel =
    includesModelPart(selectedModel, 't2v') ||
    includesModelPart(selectedModel, 'text2video')
  const isI2VModel =
    includesModelPart(selectedModel, 'i2v') ||
    includesModelPart(selectedModel, 'image2video')
  const isAliI2VModel = isAliModel && isI2VModel
  const isKeyframeModel = includesModelPart(selectedModel, 'kf2v')
  const effectiveMode = isT2VModel
    ? 'text'
    : isAliI2VModel && mode === 'text'
      ? 'first-frame'
      : mode
  const isTextMode = effectiveMode === 'text'
  const usesWan27TextParams = isAliModel && isTextMode && isWan27
  const usesWan27Media = isAliModel && !isTextMode && isWan27
  const usesLegacyTextSize = isAliModel && isTextMode && !isWan27
  const supportsLegacyShotType =
    isAliModel && !isWan27 && !includesModelPart(selectedModel, 'kf2v')
  const supportsAudioSwitch =
    isAliModel && includesModelPart(selectedModel, 'wan2.6-i2v-flash')
  const effectiveDuration = isKeyframeModel ? '5' : duration
  const durationNumber = Number.parseInt(effectiveDuration, 10)
  const resolutionOptions =
    isAliModel && isWan27 ? WAN27_RESOLUTION_OPTIONS : RESOLUTION_OPTIONS
  const effectiveResolution = getValidResolution(resolution, resolutionOptions)
  const selectedSize = isAliModel
    ? usesLegacyTextSize
      ? legacySize
      : effectiveResolution
    : standardSize
  const selectedModeOption = MODE_OPTIONS.find(
    (option) => option.value === effectiveMode
  )
  const isModeDisabled = (nextMode: VideoMode) =>
    (isT2VModel && nextMode !== 'text') ||
    (isAliI2VModel && nextMode === 'text')

  useEffect(() => {
    if (isT2VModel && mode !== 'text') {
      setMode('text')
      return
    }
    if (isAliI2VModel && mode === 'text') {
      setMode('first-frame')
    }
  }, [isAliI2VModel, isT2VModel, mode])

  useEffect(() => {
    if (!isAliModel || usesLegacyTextSize) return
    if (!resolutionOptions.includes(resolution)) {
      setResolution(resolutionOptions[0])
    }
  }, [isAliModel, resolution, resolutionOptions, usesLegacyTextSize])

  const aliMetadata = useMemo(() => {
    if (!isAliModel) return undefined

    const input: Record<string, unknown> = {}
    const parameters: Record<string, unknown> = {
      duration: durationNumber,
      prompt_extend: promptExtend,
      watermark,
    }

    if (negativePrompt.trim()) {
      input.negative_prompt = negativePrompt.trim()
    }
    if (template.trim()) {
      input.template = template.trim()
    }
    if (seed.trim()) {
      const parsedSeed = Number.parseInt(seed.trim(), 10)
      if (Number.isFinite(parsedSeed)) {
        parameters.seed = parsedSeed
      }
    }
    if (supportsAudioSwitch && !audioEnabled) {
      parameters.audio = false
    }

    if (usesWan27TextParams) {
      parameters.resolution = effectiveResolution
      parameters.ratio = ratio
      parameters.size = ''
      if (audioUrl.trim()) {
        input.audio_url = audioUrl.trim()
      }
    } else if (usesLegacyTextSize) {
      parameters.size = legacySize
      if (shotType !== 'auto') {
        parameters.shot_type = shotType
      }
      if (audioUrl.trim()) {
        input.audio_url = audioUrl.trim()
      }
    } else if (usesWan27Media) {
      const media: MediaItem[] = []
      if (effectiveMode === 'first-frame' && firstFrame.trim()) {
        media.push({ type: 'first_frame', url: firstFrame.trim() })
      }
      if (effectiveMode === 'first-last-frame') {
        if (firstFrame.trim()) {
          media.push({ type: 'first_frame', url: firstFrame.trim() })
        }
        if (lastFrame.trim()) {
          media.push({ type: 'last_frame', url: lastFrame.trim() })
        }
      }
      if (effectiveMode === 'continuation' && firstClip.trim()) {
        media.push({ type: 'first_clip', url: firstClip.trim() })
        if (lastFrame.trim()) {
          media.push({ type: 'last_frame', url: lastFrame.trim() })
        }
      }
      if (
        audioUrl.trim() &&
        (effectiveMode === 'first-frame' ||
          effectiveMode === 'first-last-frame')
      ) {
        media.push({ type: 'driving_audio', url: audioUrl.trim() })
      }
      input.media = media
      parameters.resolution = effectiveResolution
      parameters.size = ''
    } else {
      parameters.resolution = effectiveResolution
      parameters.size = ''
      if (effectiveMode === 'first-frame' && firstFrame.trim()) {
        input.img_url = firstFrame.trim()
      }
      if (effectiveMode === 'first-last-frame') {
        input.first_frame_url = firstFrame.trim()
        input.last_frame_url = lastFrame.trim()
      }
      if (effectiveMode === 'continuation' && firstClip.trim()) {
        input.media = [{ type: 'first_clip', url: firstClip.trim() }]
      }
      if (audioUrl.trim()) {
        input.audio_url = audioUrl.trim()
      }
      if (shotType !== 'auto') {
        parameters.shot_type = shotType
      }
    }

    return {
      input: compactObject(input),
      parameters: compactObject(parameters, new Set(['size'])),
    }
  }, [
    audioUrl,
    audioEnabled,
    durationNumber,
    effectiveMode,
    effectiveResolution,
    firstClip,
    firstFrame,
    isAliModel,
    lastFrame,
    legacySize,
    mode,
    negativePrompt,
    promptExtend,
    ratio,
    seed,
    shotType,
    supportsAudioSwitch,
    template,
    usesLegacyTextSize,
    usesWan27Media,
    usesWan27TextParams,
    watermark,
  ])

  const submitMutation = useMutation({
    mutationFn: submitVideoGeneration,
    onSuccess: (data, variables) => {
      setSubmitStatus(data)
      const historyItem = createVideoHistoryItem({
        mode: effectiveMode,
        model: selectedModel,
        group: selectedGroup,
        prompt: prompt.trim(),
        image: firstFrame.trim() || undefined,
        firstFrame: firstFrame.trim() || undefined,
        lastFrame: lastFrame.trim() || undefined,
        firstClip: firstClip.trim() || undefined,
        audioUrl: audioUrl.trim() || undefined,
        negativePrompt: negativePrompt.trim() || undefined,
        template: template.trim() || undefined,
        resolution: effectiveResolution,
        ratio,
        legacySize,
        size: selectedSize,
        seconds: effectiveDuration,
        promptExtend,
        watermark,
        audioEnabled,
        shotType,
        seed: seed.trim() || undefined,
        metadata: variables.metadata,
        task: data,
      })
      activeHistoryItemRef.current = historyItem
      setHistory(saveVideoHistoryItem(historyItem))
      if (data.taskId) {
        setTaskId(data.taskId)
      } else if (data.status !== 'completed' || !data.url) {
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

  const buildRequest = (): VideoGenerationRequest => {
    const referenceImage =
      effectiveMode === 'text' ? undefined : firstFrame.trim() || undefined
    const base: VideoGenerationRequest = {
      model: selectedModel,
      prompt: prompt.trim(),
      group: selectedGroup,
      seconds: effectiveDuration,
      duration: durationNumber,
    }

    if (isAliModel) {
      return {
        ...base,
        input_reference: referenceImage,
        metadata: aliMetadata,
      }
    }

    return {
      ...base,
      image: referenceImage,
      size: standardSize,
    }
  }

  const validateForm = () => {
    if (!selectedModel) {
      toast.error(t('Please select a model'))
      return false
    }
    if (!prompt.trim()) {
      toast.error(t('Please enter a prompt'))
      return false
    }
    if (effectiveMode === 'first-frame' && !firstFrame.trim()) {
      toast.error(t('Please provide a first frame image'))
      return false
    }
    if (effectiveMode === 'first-last-frame') {
      if (!firstFrame.trim()) {
        toast.error(t('Please provide a first frame image'))
        return false
      }
      if (!lastFrame.trim()) {
        toast.error(t('Please provide a last frame image'))
        return false
      }
    }
    if (effectiveMode === 'continuation' && !firstClip.trim()) {
      toast.error(t('Please provide a first video clip'))
      return false
    }
    if (seed.trim() && !Number.isFinite(Number.parseInt(seed.trim(), 10))) {
      toast.error(t('Seed must be a number'))
      return false
    }
    return true
  }

  const handleGenerate = () => {
    if (!validateForm()) return
    setTaskId('')
    setSubmitStatus(null)
    activeHistoryItemRef.current = null
    submitMutation.mutate(buildRequest())
  }

  const handleRestore = (item: VideoGenerationHistoryItem) => {
    setMode((item.mode as VideoMode) || 'text')
    setModel(item.model)
    setGroup(item.group || 'default')
    setPrompt(item.prompt)
    setFirstFrame(item.firstFrame || item.image || '')
    setLastFrame(item.lastFrame || '')
    setFirstClip(item.firstClip || '')
    setAudioUrl(item.audioUrl || '')
    setNegativePrompt(item.negativePrompt || '')
    setTemplate(item.template || '')
    setResolution(item.resolution || '720P')
    setRatio(item.ratio || '16:9')
    setLegacySize(item.legacySize || item.size || '1280*720')
    setStandardSize(item.size?.replaceAll('*', 'x') || '1280x720')
    setDuration(item.seconds || '5')
    setPromptExtend(item.promptExtend ?? true)
    setWatermark(item.watermark ?? false)
    setAudioEnabled(item.audioEnabled ?? true)
    setShotType(item.shotType || 'auto')
    setSeed(item.seed || '')
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
    <div className='grid h-full grid-cols-1 gap-4 overflow-auto p-4 xl:grid-cols-[420px_1fr]'>
      <div className='flex flex-col gap-4'>
        <Card className='h-fit'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Film />
              {t('Video generation')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel>{t('Task type')}</FieldLabel>
                <Select
                  value={effectiveMode}
                  onValueChange={(value) => setMode(value as VideoMode)}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue>
                      {selectedModeOption ? t(selectedModeOption.label) : ''}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {MODE_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          disabled={isModeDisabled(option.value)}
                        >
                          <span className='flex flex-col'>
                            <span>{t(option.label)}</span>
                            <span className='text-muted-foreground text-xs'>
                              {t(option.description)}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                <Field>
                  <FieldLabel>{t('Model')}</FieldLabel>
                  <ModelSelector
                    selectedModel={selectedModel}
                    models={models}
                    onModelChange={setModel}
                    disabled={isLoadingModels}
                    className='w-full'
                  />
                </Field>

                <Field>
                  <FieldLabel>{t('Group')}</FieldLabel>
                  <GroupSelector
                    selectedGroup={selectedGroup}
                    groups={groups}
                    onGroupChange={setGroup}
                    className='w-full'
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel>{t('Prompt')}</FieldLabel>
                <Textarea
                  rows={5}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={t('Describe the video you want to generate')}
                />
                {effectiveMode !== 'text' && (
                  <FieldDescription>
                    {t('Guides motion and style for image-to-video models.')}
                  </FieldDescription>
                )}
              </Field>

              <VideoMaterialFields
                mode={effectiveMode}
                firstFrame={firstFrame}
                setFirstFrame={setFirstFrame}
                lastFrame={lastFrame}
                setLastFrame={setLastFrame}
                firstClip={firstClip}
                setFirstClip={setFirstClip}
              />

              {(isAliModel || effectiveMode !== 'continuation') && (
                <Field>
                  <FieldLabel>{t('Audio URL')}</FieldLabel>
                  <Input
                    value={audioUrl}
                    onChange={(event) => setAudioUrl(event.target.value)}
                    placeholder='https://.../audio.mp3'
                  />
                  <FieldDescription>
                    {t('Used as audio_url or driving_audio when supported.')}
                  </FieldDescription>
                </Field>
              )}

              <Separator />

              <FieldGroup className='gap-4'>
                <Field>
                  <FieldTitle>{t('Generation parameters')}</FieldTitle>
                  <FieldDescription>
                    {isAliModel
                      ? t('Aliyun Wan parameters are sent via metadata.')
                      : t('Standard video parameters are sent directly.')}
                  </FieldDescription>
                </Field>

                <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                  {usesWan27TextParams ? (
                    <>
                      <SelectField
                        label={t('Resolution')}
                        value={resolution}
                        options={resolutionOptions}
                        onChange={setResolution}
                      />
                      <SelectField
                        label={t('Ratio')}
                        value={ratio}
                        options={RATIO_OPTIONS}
                        onChange={setRatio}
                      />
                    </>
                  ) : usesLegacyTextSize ? (
                    <SelectField
                      label={t('Size')}
                      value={legacySize}
                      options={LEGACY_SIZE_OPTIONS}
                      onChange={setLegacySize}
                    />
                  ) : isAliModel ? (
                    <SelectField
                      label={t('Resolution')}
                      value={resolution}
                      options={resolutionOptions}
                      onChange={setResolution}
                    />
                  ) : (
                    <SelectField
                      label={t('Size')}
                      value={standardSize}
                      options={STANDARD_SIZE_OPTIONS}
                      onChange={setStandardSize}
                    />
                  )}

                  <SelectField
                    label={t('Duration (seconds)')}
                    value={effectiveDuration}
                    options={DURATION_OPTIONS}
                    onChange={setDuration}
                    disabled={isKeyframeModel}
                  />
                </div>

                {supportsLegacyShotType && (
                  <SelectField
                    label={t('Shot type')}
                    value={shotType}
                    options={['auto', 'multi']}
                    onChange={setShotType}
                  />
                )}

                <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                  <SwitchField
                    label={t('Prompt extension')}
                    description={t('prompt_extend')}
                    checked={promptExtend}
                    onCheckedChange={setPromptExtend}
                  />
                  <SwitchField
                    label={t('Watermark')}
                    description={t('watermark')}
                    checked={watermark}
                    onCheckedChange={setWatermark}
                  />
                  {supportsAudioSwitch && (
                    <SwitchField
                      label={t('Audio')}
                      description={t('audio')}
                      checked={audioEnabled}
                      onCheckedChange={setAudioEnabled}
                    />
                  )}
                </div>

                {isAliModel && (
                  <>
                    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                      <Field>
                        <FieldLabel>{t('Seed')}</FieldLabel>
                        <Input
                          inputMode='numeric'
                          value={seed}
                          onChange={(event) => setSeed(event.target.value)}
                          placeholder='12345'
                        />
                      </Field>
                      <Field>
                        <FieldLabel>{t('Template')}</FieldLabel>
                        <Input
                          value={template}
                          onChange={(event) => setTemplate(event.target.value)}
                          placeholder='mech1'
                        />
                      </Field>
                    </div>

                    <Field>
                      <FieldLabel>{t('Negative prompt')}</FieldLabel>
                      <Textarea
                        rows={2}
                        value={negativePrompt}
                        onChange={(event) =>
                          setNegativePrompt(event.target.value)
                        }
                        placeholder={t('Optional negative prompt')}
                      />
                    </Field>
                  </>
                )}
              </FieldGroup>

              {isKeyframeModel && (
                <Alert>
                  <AlertCircle />
                  <AlertTitle>{t('Fixed duration')}</AlertTitle>
                  <AlertDescription>
                    {t('This first/last-frame model uses a fixed 5 seconds.')}
                  </AlertDescription>
                </Alert>
              )}

              <Button
                className='w-full'
                onClick={handleGenerate}
                disabled={isBusy || isLoadingModels}
              >
                {isBusy ? <Spinner /> : <Sparkles data-icon='inline-start' />}
                {t('Generate')}
              </Button>
            </FieldGroup>
          </CardContent>
        </Card>

        <VideoHistory
          history={history}
          onRestore={handleRestore}
          onClear={() => setHistory(clearVideoHistory())}
        />
      </div>

      <VideoResult current={current} />
    </div>
  )
}

function VideoMaterialFields({
  mode,
  firstFrame,
  setFirstFrame,
  lastFrame,
  setLastFrame,
  firstClip,
  setFirstClip,
}: {
  mode: VideoMode
  firstFrame: string
  setFirstFrame: (value: string) => void
  lastFrame: string
  setLastFrame: (value: string) => void
  firstClip: string
  setFirstClip: (value: string) => void
}) {
  const { t } = useTranslation()

  if (mode === 'text') return null

  if (mode === 'continuation') {
    return (
      <FieldGroup>
        <Field>
          <FieldLabel>{t('First video clip')}</FieldLabel>
          <Input
            value={firstClip}
            onChange={(event) => setFirstClip(event.target.value)}
            placeholder='https://.../clip.mp4'
          />
          <FieldDescription>
            {t('Sent as media type first_clip.')}
          </FieldDescription>
        </Field>
        <ReferenceImageField
          value={lastFrame}
          onChange={setLastFrame}
          label={t('Last frame')}
          optional
        />
      </FieldGroup>
    )
  }

  return (
    <FieldGroup>
      <ReferenceImageField
        value={firstFrame}
        onChange={setFirstFrame}
        label={t('First frame')}
      />
      {mode === 'first-last-frame' && (
        <ReferenceImageField
          value={lastFrame}
          onChange={setLastFrame}
          label={t('Last frame')}
        />
      )}
    </FieldGroup>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select value={value} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger className='w-full' disabled={disabled}>
          <SelectValue>{value}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}

function SwitchField({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <Field orientation='horizontal' className='rounded-lg border p-3'>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
      <FieldContent>
        <FieldLabel>{label}</FieldLabel>
        <FieldDescription>{description}</FieldDescription>
      </FieldContent>
    </Field>
  )
}

function VideoResult({ current }: { current: VideoTaskStatus | null }) {
  const { t } = useTranslation()

  if (!current) {
    return (
      <div className='text-muted-foreground flex h-full min-h-[300px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed'>
        <Clapperboard />
        <p>{t('Generated video will appear here')}</p>
      </div>
    )
  }

  if (current.status === 'completed' && current.url) {
    return (
      <div className='flex flex-col gap-3'>
        <video
          src={current.url}
          controls
          className='w-full rounded-lg border'
        />
        <Button
          variant='link'
          className='w-fit px-0'
          render={<a href={current.url} target='_blank' rel='noreferrer' />}
        >
          <Link2 />
          {t('Open video in new tab')}
        </Button>
        <VideoTaskDetails task={current} />
      </div>
    )
  }

  return (
    <div className='flex h-full min-h-[300px] flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-6'>
      {current.status === 'failed' ? (
        <Clapperboard className='text-destructive' />
      ) : (
        <Spinner className='text-muted-foreground' />
      )}
      <div className='flex w-full max-w-md flex-col gap-3'>
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
          <Clock />
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
      <CardContent className='flex flex-col gap-3'>
        {history.length === 0 ? (
          <p className='text-muted-foreground text-sm'>{t('No history yet')}</p>
        ) : (
          history.map((item) => (
            <div
              key={item.id}
              className='flex flex-col gap-2 rounded-lg border p-3'
            >
              <div className='flex items-start gap-3'>
                <div className='bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md'>
                  {item.task.status === 'completed' ? (
                    <PlayCircle />
                  ) : item.mode === 'text' ? (
                    <Film />
                  ) : (
                    <Image />
                  )}
                </div>
                <div className='min-w-0 flex-1'>
                  <div className='truncate text-sm font-medium'>
                    {item.prompt ||
                      item.firstFrame ||
                      item.firstClip ||
                      item.image ||
                      item.task.taskId}
                  </div>
                  <div className='text-muted-foreground truncate text-xs'>
                    {item.task.upstreamModel || item.model} ·{' '}
                    {item.mode ? t(item.mode) : t('video')} ·{' '}
                    {item.size || item.resolution || '-'} ·{' '}
                    {formatDateTimeObject(new Date(item.updatedAt))}
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
    { label: t('Quota'), value: task.quota ? String(task.quota) : undefined },
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
