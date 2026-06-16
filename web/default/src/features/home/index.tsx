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
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { Markdown } from '@/components/ui/markdown'
import { PublicLayout } from '@/components/layout'
import { Footer } from '@/components/layout/components/footer'
import { CTA, Features, Hero, HowItWorks, Models, Stats } from './components'
import { useHomePageContent } from './hooks'

const landingThemeVars = {
  '--background': 'oklch(0.057 0 0)',
  '--foreground': 'oklch(0.98 0 0)',
  '--card': 'oklch(0.113 0 0)',
  '--card-foreground': 'oklch(0.98 0 0)',
  '--muted': 'oklch(0.15 0 0)',
  '--muted-foreground': 'oklch(0.65 0 0)',
  '--accent': 'oklch(0.15 0 0)',
  '--accent-foreground': 'oklch(0.98 0 0)',
  '--primary': 'oklch(0.67 0.195 165)',
  '--primary-foreground': 'oklch(0.15 0 0)',
  '--border': 'oklch(1 0 0 / 0.08)',
  '--input': 'oklch(1 0 0 / 0.14)',
  '--ring': 'oklch(0.67 0.195 165)',
} as CSSProperties

export function Home() {
  const { t } = useTranslation()
  const { auth } = useAuthStore()
  const isAuthenticated = !!auth.user
  const { content, isLoaded, isUrl } = useHomePageContent()

  if (!isLoaded) {
    return (
      <PublicLayout showMainContainer={false}>
        <main className='flex min-h-screen items-center justify-center'>
          <div className='text-muted-foreground'>{t('Loading...')}</div>
        </main>
      </PublicLayout>
    )
  }

  if (content) {
    return (
      <PublicLayout showMainContainer={false}>
        <main className='overflow-x-hidden'>
          {isUrl ? (
            <iframe
              src={content}
              className='h-screen w-full border-none'
              title={t('Custom Home Page')}
            />
          ) : (
            <div className='container mx-auto py-8'>
              <Markdown className='custom-home-content'>{content}</Markdown>
            </div>
          )}
        </main>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout
      showMainContainer={false}
      headerProps={{ className: 'dark text-foreground' }}
    >
      <div
        className='dark bg-background text-foreground min-h-screen'
        style={landingThemeVars}
      >
        <Hero isAuthenticated={isAuthenticated} />
        <Stats />
        <Features />
        <Models />
        <HowItWorks />
        <CTA isAuthenticated={isAuthenticated} />
        <Footer className='bg-background' />
      </div>
    </PublicLayout>
  )
}
