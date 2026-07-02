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
import { useTheme } from '@/context/theme-provider'
import { Markdown } from '@/components/ui/markdown'
import { PublicLayout } from '@/components/layout'
import { Footer } from '@/components/layout/components/footer'
import { CTA, Features, Hero, HowItWorks, Models, Stats } from './components'
import { useHomePageContent } from './hooks'

const landingDarkThemeVars = {
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

const landingLightThemeVars = {
  '--background': 'oklch(0.985 0.006 165)',
  '--foreground': 'oklch(0.18 0.015 165)',
  '--card': 'oklch(1 0 0)',
  '--card-foreground': 'oklch(0.18 0.015 165)',
  '--muted': 'oklch(0.94 0.01 165)',
  '--muted-foreground': 'oklch(0.46 0.02 165)',
  '--accent': 'oklch(0.93 0.025 165)',
  '--accent-foreground': 'oklch(0.18 0.015 165)',
  '--primary': 'oklch(0.49 0.15 165)',
  '--primary-foreground': 'oklch(0.99 0.006 165)',
  '--border': 'oklch(0.82 0.018 165)',
  '--input': 'oklch(0.82 0.018 165)',
  '--ring': 'oklch(0.49 0.15 165)',
} as CSSProperties

export function Home() {
  const { t } = useTranslation()
  const { auth } = useAuthStore()
  const { resolvedTheme } = useTheme()
  const isAuthenticated = !!auth.user
  const { content, isLoaded, isUrl } = useHomePageContent()
  const landingThemeVars =
    resolvedTheme === 'dark' ? landingDarkThemeVars : landingLightThemeVars

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
    if (isUrl) {
      return (
        <PublicLayout showMainContainer={false}>
          <iframe
            src={content}
            className='h-screen w-full border-none'
            title={t('Custom Home Page')}
            sandbox='allow-forms allow-popups allow-popups-to-escape-sandbox allow-scripts'
          />
        </PublicLayout>
      )
    }

    const contentIsHtml = isLikelyHtml(content)

    if (contentIsHtml) {
      return (
        <PublicLayout showMainContainer={false}>
          <RichContent
            mode='html'
            htmlVariant='isolated'
            content={content}
            className='custom-home-content'
          />
        </PublicLayout>
      )
    }

    return (
      <PublicLayout>
        <div className='mx-auto max-w-6xl px-4 py-8'>
          <RichContent
            mode='markdown'
            content={content}
            className='custom-home-content'
          />
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout
      showMainContainer={false}
      headerProps={{ className: 'text-foreground' }}
    >
      <div
        className='bg-background text-foreground min-h-screen'
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
