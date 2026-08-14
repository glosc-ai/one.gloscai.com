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

interface StatsProps {
  className?: string
}

interface StatItem {
  value: string
  label: string
}

export function Stats(_props: StatsProps) {
  const { t } = useTranslation()

  const stats: StatItem[] = [
    { value: '200+', label: t('available models') },
    { value: '99.9%', label: t('service availability') },
    { value: '<50ms', label: t('routing latency') },
    { value: '10B+', label: t('daily tokens') },
  ]

  return (
    <section className='border-border relative z-10 border-b'>
      <div className='mx-auto max-w-6xl'>
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'>
          {stats.map((s, index) => (
            <div
              key={s.label}
              className={cn(
                'border-border px-6 py-8 lg:py-10',
                index < stats.length - 1 && 'border-b sm:border-b-0',
                index % 2 === 0 && 'sm:border-r',
                index < stats.length - 1 && 'lg:border-r',
                index === stats.length - 1 && 'lg:border-r-0'
              )}
            >
              <span className='block font-mono text-3xl font-bold tracking-normal tabular-nums'>
                {s.value}
              </span>
              <span className='text-muted-foreground mt-2 block text-xs font-semibold tracking-[0.08em] uppercase'>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
