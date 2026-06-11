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
import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { FileAudio, Mic, Sparkles, Square, Trash2, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { ModelSelector, GroupSelector } from '@/components/model-group-selector'
import { transcribeSpeech } from '../api'
import { useMediaModels } from '../hooks/use-media-models'
import type { SpeechToTextResult } from '../types'

const ACCEPTED_AUDIO =
  '.flac,.m4a,.mp3,.mp4,.mpeg,.mpga,.oga,.ogg,.wav,.webm,audio/*'

function formatBytes(size: number): string {
  if (!size) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(size) / Math.log(1024))
  )
  return `${(size / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`
}

function formatDuration(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return '-'
  const total = Math.round(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function getSupportedRecordingMimeType(): string | undefined {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ]
  return candidates.find((type) => MediaRecorder.isTypeSupported(type))
}

function getRecordingExtension(mimeType: string | undefined): string {
  if (!mimeType) return 'webm'
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('mp4')) return 'm4a'
  return 'webm'
}

export function SpeechToText() {
  const { t } = useTranslation()
  const { models, groups, isLoadingModels } = useMediaModels('audio_stt')

  const [model, setModel] = useState('')
  const [group, setGroup] = useState('default')
  const [language, setLanguage] = useState('')
  const [prompt, setPrompt] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<SpeechToTextResult | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordingChunksRef = useRef<BlobPart[]>([])
  const recordingStreamRef = useRef<MediaStream | null>(null)
  const recordingUrlRef = useRef<string | null>(null)

  const canRecordAudio =
    typeof navigator !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia

  const selectedModel = model || models[0]?.value || ''
  const selectedGroup =
    groups.length > 0 && !groups.some((g) => g.value === group)
      ? (groups.find((g) => g.value === 'default')?.value ?? groups[0].value)
      : group

  const mutation = useMutation({
    mutationFn: transcribeSpeech,
    onSuccess: (data) => {
      setResult(data)
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t('Failed to transcribe audio')
      )
    },
  })

  useEffect(() => {
    if (!isRecording) return
    const timer = window.setInterval(() => {
      setRecordingSeconds((seconds) => seconds + 1)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [isRecording])

  useEffect(() => {
    return () => {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== 'inactive'
      ) {
        mediaRecorderRef.current.stop()
      }
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop())
      if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current)
    }
  }, [])

  const handleFileChange = (next: File | null, nextRecordingUrl?: string) => {
    if (
      recordingUrlRef.current &&
      recordingUrlRef.current !== nextRecordingUrl
    ) {
      URL.revokeObjectURL(recordingUrlRef.current)
    }
    recordingUrlRef.current = nextRecordingUrl ?? null
    setRecordingUrl(nextRecordingUrl ?? null)
    setFile(next)
    setResult(null)
    if (fileInputRef.current && !next) {
      fileInputRef.current.value = ''
    }
  }

  const stopRecordingTracks = () => {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop())
    recordingStreamRef.current = null
  }

  const handleStartRecording = async () => {
    if (!canRecordAudio) {
      toast.error(t('Your browser does not support audio recording'))
      return
    }

    try {
      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl)
        setRecordingUrl(null)
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = getSupportedRecordingMimeType()
      const mediaRecorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      )
      recordingChunksRef.current = []
      recordingStreamRef.current = stream

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const recordedMimeType = mimeType || mediaRecorder.mimeType
        const blob = new Blob(recordingChunksRef.current, {
          type: recordedMimeType,
        })
        const extension = getRecordingExtension(recordedMimeType)
        const recordedFile = new File(
          [blob],
          `recording-${Date.now()}.${extension}`,
          { type: recordedMimeType }
        )
        const url = URL.createObjectURL(blob)
        handleFileChange(recordedFile, url)
        setIsRecording(false)
        stopRecordingTracks()
        toast.success(t('Recorded audio ready'))
      }

      mediaRecorder.onerror = () => {
        setIsRecording(false)
        stopRecordingTracks()
        toast.error(t('Microphone permission was denied or unavailable'))
      }

      setRecordingSeconds(0)
      setResult(null)
      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setIsRecording(true)
    } catch {
      setIsRecording(false)
      stopRecordingTracks()
      toast.error(t('Microphone permission was denied or unavailable'))
    }
  }

  const handleStopRecording = () => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    }
  }

  const handleSubmit = () => {
    if (!selectedModel) {
      toast.error(t('Please select a model'))
      return
    }
    if (!file) {
      toast.error(t('Please choose an audio file'))
      return
    }
    mutation.mutate({
      model: selectedModel,
      group: selectedGroup,
      file,
      language: language.trim() || undefined,
      prompt: prompt.trim() || undefined,
      response_format: 'verbose_json',
    })
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
              <Label>{t('Audio file')}</Label>
              <input
                ref={fileInputRef}
                type='file'
                accept={ACCEPTED_AUDIO}
                className='hidden'
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
              <Button
                type='button'
                variant='outline'
                className='w-full justify-start'
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className='mr-2 h-4 w-4' />
                {file ? file.name : t('Choose audio file')}
              </Button>
              {file && (
                <p className='text-muted-foreground text-xs'>
                  {formatBytes(file.size)}
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <Label>{t('Record audio')}</Label>
              <div className='grid grid-cols-2 gap-2'>
                <Button
                  type='button'
                  variant={isRecording ? 'secondary' : 'outline'}
                  onClick={handleStartRecording}
                  disabled={
                    isRecording ||
                    mutation.isPending ||
                    isLoadingModels ||
                    !canRecordAudio
                  }
                >
                  <Mic className='mr-2 h-4 w-4' />
                  {t('Start recording')}
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  onClick={handleStopRecording}
                  disabled={!isRecording}
                >
                  <Square className='mr-2 h-4 w-4' />
                  {t('Stop recording')}
                </Button>
              </div>
              <div className='text-muted-foreground flex min-h-5 items-center justify-between text-xs'>
                <span>
                  {isRecording
                    ? t('Recording...')
                    : recordingUrl
                      ? t('Recorded audio')
                      : t('Use your microphone to record audio')}
                </span>
                <span>{formatDuration(recordingSeconds)}</span>
              </div>
              {recordingUrl && (
                <div className='space-y-2 rounded-md border p-2'>
                  <audio src={recordingUrl} controls className='w-full' />
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    className='w-full'
                    onClick={() => handleFileChange(null)}
                    disabled={mutation.isPending}
                  >
                    <Trash2 className='mr-2 h-4 w-4' />
                    {t('Clear recording')}
                  </Button>
                </div>
              )}
              {!canRecordAudio && (
                <p className='text-muted-foreground text-xs'>
                  {t('Your browser does not support audio recording')}
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <Label>{t('Language (optional)')}</Label>
              <Input
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder={t('e.g. en, zh, ja')}
              />
            </div>

            <div className='space-y-2'>
              <Label>{t('Prompt (optional)')}</Label>
              <Textarea
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t(
                  'Hint vocabulary or context for the transcription'
                )}
              />
            </div>

            <Button
              className='w-full'
              onClick={handleSubmit}
              disabled={mutation.isPending || isLoadingModels}
            >
              {mutation.isPending ? (
                <Spinner className='mr-2' />
              ) : (
                <Sparkles className='mr-2 h-4 w-4' />
              )}
              {t('Transcribe')}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className='min-h-[200px]'>
        {!result && !mutation.isPending ? (
          <div className='text-muted-foreground flex h-full min-h-[300px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed'>
            <Mic className='h-10 w-10' />
            <p>{t('The transcription will appear here')}</p>
          </div>
        ) : (
          <Card className='h-full'>
            <CardContent className='space-y-4 p-4'>
              <div className='text-muted-foreground flex flex-wrap items-center gap-3 text-xs'>
                {file && (
                  <span className='inline-flex items-center gap-1'>
                    <FileAudio className='h-3.5 w-3.5' />
                    {file.name}
                  </span>
                )}
                {result?.duration ? (
                  <span>
                    {t('Duration')}: {formatDuration(result.duration)}
                  </span>
                ) : null}
                {result?.language ? (
                  <span>
                    {t('Language')}: {result.language}
                  </span>
                ) : null}
              </div>
              {mutation.isPending ? (
                <div className='flex items-center gap-2 text-sm'>
                  <Spinner />
                  {t('Transcribing...')}
                </div>
              ) : (
                <Textarea
                  rows={18}
                  readOnly
                  value={result?.text ?? ''}
                  className='font-mono text-sm'
                />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
