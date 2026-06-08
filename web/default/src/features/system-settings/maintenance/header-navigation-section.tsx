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
import { useEffect, useMemo } from 'react'
import * as z from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  SettingsControlChildren,
  SettingsForm,
  SettingsSwitchContent,
  SettingsControlGroup,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import {
  HEADER_NAV_DEFAULT,
  type HeaderNavCustomLinkConfig,
  type HeaderNavModulesConfig,
  serializeHeaderNavModules,
} from './config'

const CUSTOM_LINK_LIMIT = 8
const EXTERNAL_HREF_RE = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i

type HeaderNavFormValues = {
  home: boolean
  console: boolean
  pricingEnabled: boolean
  pricingRequireAuth: boolean
  rankingsEnabled: boolean
  rankingsRequireAuth: boolean
  docs: boolean
  about: boolean
  feedback: boolean
  customLinks: HeaderNavCustomLinkConfig[]
}

type HeaderNavBooleanField = Exclude<keyof HeaderNavFormValues, 'customLinks'>

type HeaderNavigationSectionProps = {
  config: HeaderNavModulesConfig
  initialSerialized: string
}

const toFormValues = (config: HeaderNavModulesConfig): HeaderNavFormValues => ({
  home:
    config.home === undefined ? HEADER_NAV_DEFAULT.home : Boolean(config.home),
  console:
    config.console === undefined
      ? HEADER_NAV_DEFAULT.console
      : Boolean(config.console),
  pricingEnabled:
    config.pricing?.enabled === undefined
      ? HEADER_NAV_DEFAULT.pricing.enabled
      : Boolean(config.pricing.enabled),
  pricingRequireAuth:
    config.pricing?.requireAuth === undefined
      ? HEADER_NAV_DEFAULT.pricing.requireAuth
      : Boolean(config.pricing.requireAuth),
  rankingsEnabled:
    config.rankings?.enabled === undefined
      ? HEADER_NAV_DEFAULT.rankings.enabled
      : Boolean(config.rankings.enabled),
  rankingsRequireAuth:
    config.rankings?.requireAuth === undefined
      ? HEADER_NAV_DEFAULT.rankings.requireAuth
      : Boolean(config.rankings.requireAuth),
  docs:
    config.docs === undefined ? HEADER_NAV_DEFAULT.docs : Boolean(config.docs),
  about:
    config.about === undefined
      ? HEADER_NAV_DEFAULT.about
      : Boolean(config.about),
  feedback:
    config.feedback === undefined
      ? HEADER_NAV_DEFAULT.feedback
      : Boolean(config.feedback),
  customLinks: Array.isArray(config.customLinks)
    ? config.customLinks.map((link) => ({
        title: link.title,
        href: link.href,
      }))
    : [],
})

const createEmptyCustomLink = (): HeaderNavCustomLinkConfig => ({
  title: '',
  href: '',
})

const isSupportedCustomLinkHref = (href: string): boolean =>
  href.startsWith('/') || EXTERNAL_HREF_RE.test(href)

export function HeaderNavigationSection({
  config,
  initialSerialized,
}: HeaderNavigationSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const formDefaults = useMemo(() => toFormValues(config), [config])
  const headerNavSchema = useMemo(
    () =>
      z.object({
        home: z.boolean(),
        console: z.boolean(),
        pricingEnabled: z.boolean(),
        pricingRequireAuth: z.boolean(),
        rankingsEnabled: z.boolean(),
        rankingsRequireAuth: z.boolean(),
        docs: z.boolean(),
        about: z.boolean(),
        feedback: z.boolean(),
        customLinks: z
          .array(
            z.object({
              title: z
                .string()
                .trim()
                .min(1, t('Link label is required'))
                .max(64, t('Link label must be 64 characters or fewer')),
              href: z
                .string()
                .trim()
                .min(1, t('Link URL is required'))
                .refine(isSupportedCustomLinkHref, {
                  message: t(
                    'Use an internal path like /pricing or a full URL like https://example.com'
                  ),
                }),
            })
          )
          .max(
            CUSTOM_LINK_LIMIT,
            t('You can add up to {{count}} custom links', {
              count: CUSTOM_LINK_LIMIT,
            })
          ),
      }),
    [t]
  )

  const form = useForm<HeaderNavFormValues>({
    resolver: zodResolver(headerNavSchema),
    defaultValues: formDefaults,
  })
  const customLinks = useFieldArray({
    control: form.control,
    name: 'customLinks',
  })

  useEffect(() => {
    form.reset(formDefaults)
  }, [formDefaults, form])

  const onSubmit = async (values: HeaderNavFormValues) => {
    const payload: HeaderNavModulesConfig = {
      ...config,
      home: values.home,
      console: values.console,
      docs: values.docs,
      about: values.about,
      feedback: values.feedback,
      pricing: {
        ...(config.pricing ?? HEADER_NAV_DEFAULT.pricing),
        enabled: values.pricingEnabled,
        requireAuth: values.pricingRequireAuth,
      },
      rankings: {
        ...(config.rankings ?? HEADER_NAV_DEFAULT.rankings),
        enabled: values.rankingsEnabled,
        requireAuth: values.rankingsRequireAuth,
      },
      customLinks: values.customLinks.map((link) => ({
        title: link.title.trim(),
        href: link.href.trim(),
      })),
    }

    const serialized = serializeHeaderNavModules(payload)
    if (serialized === initialSerialized) {
      return
    }

    await updateOption.mutateAsync({
      key: 'HeaderNavModules',
      value: serialized,
    })
  }

  const resetToDefault = () => {
    form.reset(toFormValues(HEADER_NAV_DEFAULT))
  }

  const simpleModules: Array<{
    key: HeaderNavBooleanField
    title: string
    description: string
  }> = [
    {
      key: 'home',
      title: t('Home'),
      description: t('Landing page with system overview.'),
    },
    {
      key: 'console',
      title: t('Console'),
      description: t('User dashboard and quota controls.'),
    },
    {
      key: 'docs',
      title: t('Docs'),
      description: t('Documentation or external knowledge base.'),
    },
    {
      key: 'about',
      title: t('About'),
      description: t('Static page describing the platform.'),
    },
    {
      key: 'feedback',
      title: t('Feedback'),
      description: t('Markdown feedback page for support or contact details.'),
    },
  ]

  const accessModules: Array<{
    enabledKey: HeaderNavBooleanField
    requireAuthKey: HeaderNavBooleanField
    requireAuthDependsOn: 'pricingEnabled' | 'rankingsEnabled'
    title: string
    description: string
    requireAuthTitle: string
    requireAuthDescription: string
  }> = [
    {
      enabledKey: 'pricingEnabled',
      requireAuthKey: 'pricingRequireAuth',
      requireAuthDependsOn: 'pricingEnabled',
      title: t('Model Square'),
      description: t('Public model catalog and pricing page.'),
      requireAuthTitle: t('Require login to view models'),
      requireAuthDescription: t(
        'Visitors must authenticate before accessing the pricing directory.'
      ),
    },
    {
      enabledKey: 'rankingsEnabled',
      requireAuthKey: 'rankingsRequireAuth',
      requireAuthDependsOn: 'rankingsEnabled',
      title: t('Rankings'),
      description: t('Public rankings page based on live usage data.'),
      requireAuthTitle: t('Require login to view rankings'),
      requireAuthDescription: t(
        'Visitors must authenticate before accessing the rankings page.'
      ),
    },
  ]

  return (
    <SettingsSection title={t('Header navigation')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            onReset={resetToDefault}
            isSaving={updateOption.isPending}
            resetLabel='Reset to default'
            saveLabel='Save navigation'
          />
          <div className='grid gap-4 md:grid-cols-2'>
            {simpleModules.map((module) => (
              <FormField
                key={module.key}
                control={form.control}
                name={module.key}
                render={({ field }) => (
                  <SettingsSwitchItem>
                    <SettingsSwitchContent>
                      <FormLabel>{module.title}</FormLabel>
                      <FormDescription>{module.description}</FormDescription>
                    </SettingsSwitchContent>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </SettingsSwitchItem>
                )}
              />
            ))}
          </div>

          <div className='grid gap-4 lg:grid-cols-2'>
            {accessModules.map((module) => (
              <SettingsControlGroup key={module.enabledKey}>
                <FormField
                  control={form.control}
                  name={module.enabledKey}
                  render={({ field }) => (
                    <SettingsSwitchItem>
                      <SettingsSwitchContent>
                        <FormLabel>{module.title}</FormLabel>
                        <FormDescription>{module.description}</FormDescription>
                      </SettingsSwitchContent>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </SettingsSwitchItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={module.requireAuthKey}
                  render={({ field }) => (
                    <SettingsControlChildren>
                      <SettingsSwitchItem className='border-b-0 py-2'>
                        <SettingsSwitchContent>
                          <FormLabel>{module.requireAuthTitle}</FormLabel>
                          <FormDescription>
                            {module.requireAuthDescription}
                          </FormDescription>
                        </SettingsSwitchContent>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={!form.watch(module.requireAuthDependsOn)}
                          />
                        </FormControl>
                        <FormMessage />
                      </SettingsSwitchItem>
                    </SettingsControlChildren>
                  )}
                />
              </SettingsControlGroup>
            ))}
          </div>

          <div data-settings-form-span='full' className='space-y-4'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
              <div className='space-y-1'>
                <h3 className='text-sm font-medium'>{t('Custom links')}</h3>
                <p className='text-muted-foreground text-sm'>
                  {t(
                    'Add redirects to internal pages or external URLs. Custom links appear after the built-in navigation items.'
                  )}
                </p>
              </div>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => customLinks.append(createEmptyCustomLink())}
                disabled={customLinks.fields.length >= CUSTOM_LINK_LIMIT}
              >
                <Plus className='mr-2 size-4' />
                {t('Add link')}
              </Button>
            </div>

            {customLinks.fields.length === 0 ? (
              <div className='text-muted-foreground rounded-xl border border-dashed px-4 py-6 text-sm'>
                {t(
                  'No custom links yet. Add one to show another destination in the top navigation.'
                )}
              </div>
            ) : (
              <div className='space-y-3'>
                {customLinks.fields.map((field, index) => (
                  <SettingsControlGroup key={field.id} className='space-y-4'>
                    <div className='flex items-start justify-between gap-4'>
                      <div className='space-y-0.5'>
                        <p className='text-sm font-medium'>
                          {t('Custom link')} {index + 1}
                        </p>
                        <p className='text-muted-foreground text-xs'>
                          {t(
                            'Use /path for internal routes or a full URL for external redirects.'
                          )}
                        </p>
                      </div>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        onClick={() => customLinks.remove(index)}
                        aria-label={t('Remove link')}
                      >
                        <Trash2 className='size-4' />
                      </Button>
                    </div>

                    <div className='grid gap-4 md:grid-cols-2'>
                      <FormField
                        control={form.control}
                        name={`customLinks.${index}.title`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('Link label')}</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t('Support center')}
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              {t('Shown directly in the top navigation bar.')}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`customLinks.${index}.href`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('Link URL')}</FormLabel>
                            <FormControl>
                              <Input
                                placeholder='/support or https://example.com'
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              {t(
                                'Internal links should start with /. External links can use https://, mailto:, or other full URLs.'
                              )}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </SettingsControlGroup>
                ))}
              </div>
            )}
          </div>
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
