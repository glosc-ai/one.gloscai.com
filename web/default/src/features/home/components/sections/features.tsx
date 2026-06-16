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
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { AnimateInView } from '@/components/animate-in-view'

interface FeaturesProps {
  className?: string
}

type FeatureApp = [initial: string, name: string, description: string]

export function Features(_props: FeaturesProps) {
  const { t } = useTranslation()

  const features = [
    {
      title: t('Unified API protocol'),
      desc: t(
        'Use an OpenAI-compatible standard interface to call every model. Switching providers only changes one model parameter, so existing code keeps working with a single base URL update.'
      ),
      meta: [t('OpenAI compatible'), t('Zero migration cost')],
      panelTitle: t('Desktop clients'),
      panelCount: t('3 verified apps'),
      apps: [
        ['C', 'Cherry Studio', t('Multi-model chat client')],
        ['D', 'DeepChat', t('AI Agent client')],
        ['A', 'AionUi', t('Desktop office agent')],
      ] satisfies FeatureApp[],
    },
    {
      title: t('Smart routing and high availability'),
      desc: t(
        'Automatically choose the best model route with built-in load balancing and failover. When a provider is unavailable, traffic moves to a backup route without interrupting users.'
      ),
      meta: [t('Automatic failover'), t('Cross-region routing')],
      panelTitle: t('CLI coding assistants'),
      panelCount: t('3 verified apps'),
      reverse: true,
      apps: [
        ['C', 'Claude Code', t('Anthropic terminal assistant')],
        ['O', 'OpenAI Codex CLI', t('Terminal coding assistant')],
        ['K', 'Kilo Code', t('Editor extension')],
      ] satisfies FeatureApp[],
    },
    {
      title: t('Usage monitoring and cost control'),
      desc: t(
        'Track calls, latency, and spend for every API key in real time. Split usage by model or team, set budget limits, and prevent unexpected bills.'
      ),
      meta: [t('Realtime dashboard'), t('Budget limits'), t('Team allocation')],
      panelTitle: t('AI agents and bots'),
      panelCount: t('3 verified apps'),
      apps: [
        ['O', 'OpenClaw', t('Personal AI assistant platform')],
        ['L', 'LangBot', t('IM bot framework')],
        ['M', 'Memoh', t('Containerized agent platform')],
      ] satisfies FeatureApp[],
    },
  ]

  return (
    <section className='relative z-10 px-6 py-20 md:py-28'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-10 max-w-xl md:mb-14'>
          <p className='text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase'>
            {t('Product capabilities')}
          </p>
          <h2 className='text-3xl leading-tight font-bold tracking-normal md:text-4xl'>
            {t('Built like infrastructure, not a wrapper')}
          </h2>
        </AnimateInView>

        <div className='flex flex-col'>
          {features.map((feature, index) => (
            <AnimateInView
              key={feature.title}
              delay={index * 120}
              className='border-border grid grid-cols-1 items-center gap-8 border-b py-10 last:border-b-0 md:py-14 lg:grid-cols-2 lg:gap-20'
            >
              <div className={cn(feature.reverse && 'lg:order-2')}>
                <h3 className='mb-3 text-2xl leading-tight font-semibold tracking-normal md:text-3xl'>
                  {feature.title}
                </h3>
                <p className='text-muted-foreground max-w-md text-sm leading-relaxed md:text-[15px]'>
                  {feature.desc}
                </p>
                <div className='text-muted-foreground mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm'>
                  {feature.meta.map((item) => (
                    <span key={item} className='flex items-center gap-2'>
                      <span className='bg-primary size-1.5 rounded-full' />
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <AppPanel
                title={feature.panelTitle}
                count={feature.panelCount}
                apps={feature.apps}
                className={cn(feature.reverse && 'lg:order-1')}
              />
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}

function AppPanel(props: {
  title: string
  count: string
  apps: FeatureApp[]
  className?: string
}) {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        'border-border bg-card overflow-hidden rounded-[0.5rem] border',
        props.className
      )}
    >
      <div className='border-border bg-muted/30 flex items-center justify-between gap-4 border-b px-5 py-4'>
        <span className='text-sm font-semibold'>{props.title}</span>
        <Badge variant='outline' className='border-primary/30 text-primary'>
          {props.count}
        </Badge>
      </div>
      <div className='flex flex-col gap-2 p-3'>
        {props.apps.map(([initial, name, desc]) => (
          <div
            key={name}
            className='border-border bg-muted/20 hover:border-primary/60 hover:bg-muted/40 flex items-center gap-3 rounded-[0.5rem] border p-3 transition-colors'
          >
            <div className='bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-[0.5rem] text-sm font-bold'>
              {initial}
            </div>
            <div className='min-w-0 flex-1'>
              <span className='block truncate text-sm font-semibold'>
                {name}
              </span>
              <span className='text-muted-foreground block truncate text-xs'>
                {desc}
              </span>
            </div>
            <Badge
              variant='outline'
              className='border-primary/30 bg-primary/10 text-primary'
            >
              {t('Integrated')}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  )
}
