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
import { AudioLines, Download, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import { synthesizeSpeech } from '../api'
import { useMediaModels } from '../hooks/use-media-models'
import type { TextToSpeechResult } from '../types'

const FORMAT_OPTIONS = ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'] as const
const VOICE_OPTIONS = [
  'alloy',
  'echo',
  'fable',
  'onyx',
  'nova',
  'shimmer',
  'coral',
  'ash',
  'sage',
] as const

const SPEED_PRESETS = ['0.5', '0.75', '1.0', '1.25', '1.5', '2.0'] as const

function formatBytes(size: number): string {
  if (!size) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(size) / Math.log(1024))
  )
  return `${(size / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`
}

function isCjkCodePoint(codePoint: number): boolean {
  return (
    (codePoint >= 0x3400 && codePoint <= 0x9fff) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0x20000 && codePoint <= 0x2ebef)
  )
}

function estimateSpeechDurationSeconds(
  text: string,
  speed?: number
): number | undefined {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return undefined

  let cjkChars = 0
  let otherChars = 0
  const nonCjkParts: string[] = []

  for (const char of normalized) {
    if (/\s/.test(char)) {
      nonCjkParts.push(' ')
      continue
    }
    const codePoint = char.codePointAt(0) ?? 0
    if (isCjkCodePoint(codePoint)) {
      cjkChars += 1
      nonCjkParts.push(' ')
    } else {
      otherChars += 1
      nonCjkParts.push(char)
    }
  }

  const wordCount = nonCjkParts.join('').split(/\s+/).filter(Boolean).length
  const estimatedSeconds =
    cjkChars / 4.5 + Math.max(wordCount / 2.6, otherChars / 14)
  const speedFactor = typeof speed === 'number' && speed > 0 ? speed : 1
  return Math.max(1, Math.ceil(estimatedSeconds / speedFactor))
}

export function TextToSpeech() {
  const { t } = useTranslation()
  const { models, groups, isLoadingModels } = useMediaModels('audio_tts')

  const [model, setModel] = useState('')
  const [group, setGroup] = useState('default')
  const [input, setInput] = useState('')
  const [voice, setVoice] = useState<string>('alloy')
  const [format, setFormat] = useState<string>('mp3')
  const [speed, setSpeed] = useState<string>('1.0')
  const [customVoice, setCustomVoice] = useState('')
  const [result, setResult] = useState<TextToSpeechResult | null>(null)
  const lastUrlRef = useRef<string | null>(null)

  const selectedModel = model || models[0]?.value || ''
  const selectedGroup =
    groups.length > 0 && !groups.some((g) => g.value === group)
      ? (groups.find((g) => g.value === 'default')?.value ?? groups[0].value)
      : group

  useEffect(() => {
    return () => {
      if (lastUrlRef.current) {
        URL.revokeObjectURL(lastUrlRef.current)
      }
    }
  }, [])

  const mutation = useMutation({
    mutationFn: synthesizeSpeech,
    onSuccess: (data) => {
      if (lastUrlRef.current) {
        URL.revokeObjectURL(lastUrlRef.current)
      }
      lastUrlRef.current = data.url
      setResult(data)
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : t('Failed to synthesize speech')
      )
    },
  })

  const handleSubmit = () => {
    if (!selectedModel) {
      toast.error(t('Please select a model'))
      return
    }
    const text = input.trim()
    if (!text) {
      toast.error(t('Please enter the text to synthesize'))
      return
    }
    const voiceValue = (customVoice.trim() || voice).trim()
    if (!voiceValue) {
      toast.error(t('Please choose a voice'))
      return
    }
    const speedValue = Number.parseFloat(speed)
    const normalizedSpeed = Number.isFinite(speedValue) ? speedValue : undefined
    mutation.mutate({
      model: selectedModel,
      group: selectedGroup,
      input: text,
      voice: voiceValue,
      response_format: format as
        | 'mp3'
        | 'opus'
        | 'aac'
        | 'flac'
        | 'wav'
        | 'pcm',
      speed: normalizedSpeed,
      estimated_duration: estimateSpeechDurationSeconds(text, normalizedSpeed),
    })
  }

  const handleDownload = () => {
    if (!result) return
    const a = document.createElement('a')
    a.href = result.url
    a.download = `speech-${Date.now()}.${format}`
    document.body.appendChild(a)
    a.click()
    a.remove()
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
              <Label>{t('Voice')}</Label>
              <Select value={voice} onValueChange={(v) => v && setVoice(v)}>
                <SelectTrigger className='w-full'>
                  <SelectValue>{voice}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {VOICE_OPTIONS.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Input
                value={customVoice}
                onChange={(e) => setCustomVoice(e.target.value)}
                placeholder={t('Custom voice id (overrides the preset)')}
              />
            </div>

            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-2'>
                <Label>{t('Format')}</Label>
                <Select value={format} onValueChange={(v) => v && setFormat(v)}>
                  <SelectTrigger className='w-full'>
                    <SelectValue>{format}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {FORMAT_OPTIONS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <Label>{t('Speed')}</Label>
                <Select value={speed} onValueChange={(v) => v && setSpeed(v)}>
                  <SelectTrigger className='w-full'>
                    <SelectValue>{speed}x</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {SPEED_PRESETS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}x
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
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
              {t('Synthesize')}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className='min-h-[200px] space-y-4'>
        <Card>
          <CardContent className='space-y-3 p-4'>
            <Label>{t('Text to synthesize')}</Label>
            <Textarea
              rows={10}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('Enter the text you want to convert to speech')}
            />
            <p className='text-muted-foreground text-xs'>
              {t('Characters')}: {input.length}
            </p>
          </CardContent>
        </Card>

        {!result && !mutation.isPending ? (
          <div className='text-muted-foreground flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed'>
            <AudioLines className='h-10 w-10' />
            <p>{t('The synthesized audio will appear here')}</p>
          </div>
        ) : (
          <Card>
            <CardContent className='space-y-3 p-4'>
              {mutation.isPending ? (
                <div className='flex items-center gap-2 text-sm'>
                  <Spinner />
                  {t('Synthesizing...')}
                </div>
              ) : result ? (
                <>
                  <audio controls src={result.url} className='w-full' />
                  <div className='text-muted-foreground flex flex-wrap items-center justify-between gap-3 text-xs'>
                    <span>
                      {result.mimeType} · {formatBytes(result.byteSize)}
                    </span>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={handleDownload}
                    >
                      <Download className='mr-2 h-4 w-4' />
                      {t('Download')}
                    </Button>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
