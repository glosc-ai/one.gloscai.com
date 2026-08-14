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
import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Activity, ArrowRight, BookOpen, CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useStatus } from '@/hooks/use-status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

const gatewayModels = [
  'openai/gpt-5.5',
  'anthropic/claude-opus-4.8',
  'google/gemini-3.5',
] as const

function randomLatency() {
  return 20 + Math.floor(Math.random() * 61)
}

function getEndpoint(status: ReturnType<typeof useStatus>['status']) {
  const candidate =
    (status as Record<string, unknown> | null)?.server_address ??
    (status as Record<string, unknown> | null)?.serverAddress ??
    (status?.data as Record<string, unknown> | undefined)?.server_address ??
    (status?.data as Record<string, unknown> | undefined)?.serverAddress

  if (candidate && typeof candidate === 'string') {
    const baseUrl = candidate.replace(/\/$/, '')
    return baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`
  }

  if (typeof window !== 'undefined') return `${window.location.origin}/v1`
  return 'https://one.gloscai.com/v1'
}

export function Hero(props: HeroProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const docsUrl =
    (status?.docs_link as string | undefined) || 'https://docs.newapi.pro'
  const endpoint = useMemo(() => getEndpoint(status), [status])

  const renderDocsButton = () => {
    const isExternal = docsUrl.startsWith('http')
    if (isExternal) {
      return (
        <Button
          variant='outline'
          className='group h-10 rounded-lg px-4 text-sm font-semibold md:h-11 md:px-5'
          render={
            <a href={docsUrl} target='_blank' rel='noopener noreferrer' />
          }
        >
          <BookOpen data-icon='inline-start' />
          <span>{t('Docs')}</span>
        </Button>
      )
    }
    return (
      <Button
        variant='outline'
        className='group h-10 rounded-lg px-4 text-sm font-semibold md:h-11 md:px-5'
        render={<Link to={docsUrl} />}
      >
        <BookOpen data-icon='inline-start' />
        <span>{t('Docs')}</span>
      </Button>
    )
  }

  return (
    <section
      className={cn(
        'border-border relative z-10 overflow-hidden border-b px-6 pt-28 pb-16 md:pt-36 md:pb-24 lg:pt-40 lg:pb-28',
        props.className
      )}
    >
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [mask-image:linear-gradient(to_bottom,black_0%,black_62%,transparent_100%)] bg-[size:3.75rem_3.75rem] opacity-35'
      />

      <div className='mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16'>
        <div className='flex max-w-xl flex-col items-start text-left'>
          <Badge
            variant='outline'
            className='landing-animate-fade-up border-primary/30 bg-primary/10 text-primary mb-5 opacity-0'
            style={{ animationDelay: '0ms' }}
          >
            <CheckCircle2 data-icon='inline-start' />
            {t('Verified AI application gateway')}
          </Badge>

          <h1
            className='landing-animate-fade-up text-[clamp(2.5rem,5.5vw,4rem)] leading-[1.08] font-bold tracking-normal opacity-0'
            style={{ animationDelay: '60ms' }}
          >
            {t('One API for every AI model')}
            <br />
            <span className='text-primary'>
              {t('Connect all AI models through one standard interface')}
            </span>
          </h1>
          <p
            className='landing-animate-fade-up text-muted-foreground mt-5 max-w-lg text-base leading-relaxed opacity-0 md:text-[17px]'
            style={{ animationDelay: '120ms' }}
          >
            {t(
              'Access hundreds of models through a unified, OpenAI-compatible protocol. Route requests, manage keys, control spend, and keep every AI application on the same gateway.'
            )}
          </p>

          <div
            className='landing-animate-fade-up mt-8 flex flex-wrap items-center gap-3 opacity-0'
            style={{ animationDelay: '180ms' }}
          >
            {props.isAuthenticated ? (
              <>
                <Button
                  className='group h-10 rounded-lg px-4 text-sm font-semibold md:h-11 md:px-5'
                  render={<Link to='/dashboard' />}
                >
                  {t('Go to Dashboard')}
                  <ArrowRight data-icon='inline-end' />
                </Button>
                {renderDocsButton()}
              </>
            ) : (
              <>
                <Button
                  className='group h-10 rounded-lg px-4 text-sm font-semibold md:h-11 md:px-5'
                  render={<Link to='/sign-up' />}
                >
                  {t('Get Started')}
                  <ArrowRight data-icon='inline-end' />
                </Button>
                <Button
                  variant='outline'
                  className='h-10 rounded-lg px-4 text-sm font-semibold md:h-11 md:px-5'
                  render={<Link to='/pricing' />}
                >
                  {t('Model Square')}
                </Button>
                {renderDocsButton()}
              </>
            )}
          </div>

          <div
            className='landing-animate-fade-up text-muted-foreground mt-10 flex flex-wrap gap-4 text-xs opacity-0'
            style={{ animationDelay: '240ms' }}
          >
            <span className='flex items-center gap-2'>
              <span className='bg-primary size-1.5 rounded-full' />
              {t('OpenAI-compatible')}
            </span>
            <span className='flex items-center gap-2'>
              <span className='bg-primary size-1.5 rounded-full' />
              {t('Failover ready')}
            </span>
            <span className='flex items-center gap-2'>
              <span className='bg-primary size-1.5 rounded-full' />
              {t('Verified clients')}
            </span>
          </div>
        </div>

        <div
          className='landing-animate-fade-up flex w-full justify-center opacity-0'
          style={{ animationDelay: '320ms' }}
        >
          <GatewayPanel t={t} endpoint={endpoint} />
        </div>
      </div>
    </section>
  )
}

function GatewayPanel(props: {
  t: ReturnType<typeof useTranslation>['t']
  endpoint: string
}) {
  const { t, endpoint } = props
  const [selectedModelName, setSelectedModelName] = useState<string>(
    gatewayModels[0]
  )
  const [latency, setLatency] = useState(randomLatency)

  useEffect(() => {
    setLatency(randomLatency())
  }, [selectedModelName])

  const rows = [
    { label: t('Request'), value: endpoint },
    {
      label: t('Model'),
      value: selectedModelName,
    },
    { label: t('Latency'), value: `${latency}ms` },
    { label: t('Status'), value: '200 OK', accent: true },
  ]

  return (
    <div className='border-border bg-card w-full max-w-xl overflow-hidden rounded-[0.5rem] border shadow-[0_24px_80px_-40px_rgba(0,0,0,0.8)]'>
      <div className='border-border bg-muted/30 flex items-center justify-between gap-4 border-b px-5 py-4'>
        <div className='flex items-center gap-3'>
          <div className='bg-primary/10 text-primary flex size-9 items-center justify-center rounded-[0.5rem]'>
            <Activity className='size-4' />
          </div>
          <div className='flex flex-col gap-0.5'>
            <span className='text-sm font-semibold'>
              {t('Unified endpoint')}
            </span>
          </div>
        </div>
        <Badge variant='outline' className='border-primary/30 text-primary'>
          {t('Live routing sample')}
        </Badge>
      </div>

      <div className='px-5 py-4'>
        {rows.map((row) => (
          <div
            key={row.label}
            className='border-border flex items-center gap-4 border-b py-3 last:border-b-0'
          >
            <span className='text-muted-foreground w-16 shrink-0 text-xs font-medium'>
              {row.label}
            </span>
            <span
              className={cn(
                'min-w-0 truncate font-mono text-sm',
                row.accent ? 'text-primary' : 'text-foreground'
              )}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>

      <div className='border-border bg-muted/20 border-t px-5 py-4'>
        <div className='flex flex-wrap gap-2'>
          {gatewayModels.map((model) => {
            const active = model === selectedModelName

            return (
              <Button
                key={model}
                type='button'
                variant={active ? 'default' : 'outline'}
                size='sm'
                aria-pressed={active}
                onClick={() => setSelectedModelName(model)}
                className={cn(
                  'h-auto rounded-md px-2.5 py-1.5 font-mono text-xs',
                  !active &&
                    'text-muted-foreground hover:border-primary hover:text-primary'
                )}
              >
                {model}
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
