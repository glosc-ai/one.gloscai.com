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

import { AnimateInView } from '@/components/animate-in-view'

export function HowItWorks() {
  const { t } = useTranslation()

  const steps = [
    {
      num: '1',
      title: t('Get an API key'),
      desc: t(
        'Create an API key in the console. Use multiple keys for isolated permissions and billing.'
      ),
    },
    {
      num: '2',
      title: t('Install your client'),
      desc: t(
        'Choose a verified client such as Cherry Studio, DeepChat, Claude Code, or your own SDK.'
      ),
    },
    {
      num: '3',
      title: t('Call hundreds of models through one endpoint'),
      desc: t(
        'Use one OpenAI-compatible API with smart routing across GPT, Claude, Gemini, and other models.'
      ),
    },
  ]

  return (
    <section className='relative z-10 px-6 py-20 md:py-28'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-12 max-w-xl'>
          <p className='text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase'>
            {t('Developer flow')}
          </p>
          <h2 className='text-3xl font-bold tracking-normal md:text-4xl'>
            {t('Three steps to launch')}
          </h2>
          <p className='text-muted-foreground mt-3 text-sm leading-relaxed md:text-[15px]'>
            {t(
              'Whether you use Python, Node.js, curl, or a desktop client, integration only takes a few minutes.'
            )}
          </p>
        </AnimateInView>

        <div className='relative grid gap-10 lg:grid-cols-3 lg:gap-0'>
          <div className='bg-border absolute top-5 right-10 left-10 hidden h-px lg:block' />
          {steps.map((step, i) => (
            <AnimateInView
              key={step.num}
              delay={i * 150}
              animation='fade-up'
              className='relative pr-0 last:pr-0 lg:pr-10'
            >
              <div className='border-border bg-background text-primary relative z-10 mb-5 flex size-10 items-center justify-center rounded-full border font-mono text-sm font-semibold'>
                {step.num}
              </div>
              <h3 className='mb-2 text-base font-semibold md:text-lg'>
                {step.title}
              </h3>
              <p className='text-muted-foreground max-w-sm text-sm leading-relaxed'>
                {step.desc}
              </p>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
