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
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
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
  SettingsForm,
  SettingsFormGrid,
  SettingsFormGridItem,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'
import { removeTrailingSlash } from './utils'

const createR2Schema = (t: (key: string) => string) =>
  z.object({
    R2StorageEnabled: z.boolean(),
    R2AccountID: z.string(),
    R2Bucket: z.string(),
    R2AccessKey: z.string(),
    R2SecretKey: z.string(),
    R2PublicBaseURL: z.string().refine((value) => {
      const trimmed = value.trim()
      if (!trimmed) return true
      return /^https?:\/\//.test(trimmed)
    }, t('Provide a valid URL starting with http:// or https://')),
    R2ObjectPrefix: z.string(),
  })

type R2FormValues = z.infer<ReturnType<typeof createR2Schema>>

type R2StorageSectionProps = {
  defaultValues: R2FormValues
}

export function R2StorageSection({ defaultValues }: R2StorageSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const r2Schema = createR2Schema(t)

  const form = useForm<R2FormValues>({
    resolver: zodResolver(r2Schema),
    defaultValues,
  })

  useResetForm(form, defaultValues)

  const onSubmit = async (values: R2FormValues) => {
    const sanitized = {
      ...values,
      R2AccountID: values.R2AccountID.trim(),
      R2Bucket: values.R2Bucket.trim(),
      R2AccessKey: values.R2AccessKey.trim(),
      R2SecretKey: values.R2SecretKey.trim(),
      R2PublicBaseURL: removeTrailingSlash(values.R2PublicBaseURL),
      R2ObjectPrefix: values.R2ObjectPrefix.trim().replace(/^\/+|\/+$/g, ''),
    }

    const updates: Array<{ key: keyof R2FormValues; value: string | boolean }> =
      [
        { key: 'R2StorageEnabled', value: sanitized.R2StorageEnabled },
        { key: 'R2AccountID', value: sanitized.R2AccountID },
        { key: 'R2Bucket', value: sanitized.R2Bucket },
        { key: 'R2PublicBaseURL', value: sanitized.R2PublicBaseURL },
        { key: 'R2ObjectPrefix', value: sanitized.R2ObjectPrefix },
      ]

    if (sanitized.R2AccessKey) {
      updates.push({ key: 'R2AccessKey', value: sanitized.R2AccessKey })
    }
    if (sanitized.R2SecretKey) {
      updates.push({ key: 'R2SecretKey', value: sanitized.R2SecretKey })
    }

    for (const update of updates) {
      if (
        update.value !== defaultValues[update.key] ||
        update.key === 'R2AccessKey' ||
        update.key === 'R2SecretKey'
      ) {
        await updateOption.mutateAsync(update)
      }
    }
  }

  return (
    <SettingsSection
      title={t('R2 Storage')}
      description={t(
        'Store uploaded reference images in Cloudflare R2 for image and video generation.'
      )}
    >
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
            saveLabel='Save R2 storage settings'
          />

          <FormField
            control={form.control}
            name='R2StorageEnabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable R2 uploads')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Reference images are uploaded to R2 before generation requests are sent.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          <SettingsFormGrid>
            <FormField
              control={form.control}
              name='R2AccountID'
              render={({ field }) => (
                <SettingsFormGridItem>
                  <FormItem>
                    <FormLabel>{t('Account ID')}</FormLabel>
                    <FormControl>
                      <Input autoComplete='off' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                </SettingsFormGridItem>
              )}
            />

            <FormField
              control={form.control}
              name='R2Bucket'
              render={({ field }) => (
                <SettingsFormGridItem>
                  <FormItem>
                    <FormLabel>{t('Bucket name')}</FormLabel>
                    <FormControl>
                      <Input autoComplete='off' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                </SettingsFormGridItem>
              )}
            />

            <FormField
              control={form.control}
              name='R2AccessKey'
              render={({ field }) => (
                <SettingsFormGridItem>
                  <FormItem>
                    <FormLabel>{t('Access key ID')}</FormLabel>
                    <FormControl>
                      <Input
                        type='password'
                        autoComplete='new-password'
                        placeholder={t('Enter new key to update')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                </SettingsFormGridItem>
              )}
            />

            <FormField
              control={form.control}
              name='R2SecretKey'
              render={({ field }) => (
                <SettingsFormGridItem>
                  <FormItem>
                    <FormLabel>{t('Secret access key')}</FormLabel>
                    <FormControl>
                      <Input
                        type='password'
                        autoComplete='new-password'
                        placeholder={t('Enter new key to update')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                </SettingsFormGridItem>
              )}
            />

            <FormField
              control={form.control}
              name='R2PublicBaseURL'
              render={({ field }) => (
                <SettingsFormGridItem span='full'>
                  <FormItem>
                    <FormLabel>{t('Public base URL')}</FormLabel>
                    <FormControl>
                      <Input
                        type='url'
                        inputMode='url'
                        placeholder='https://media.example.com'
                        autoComplete='off'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Use a public R2 custom domain or r2.dev URL that can serve uploaded objects.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                </SettingsFormGridItem>
              )}
            />

            <FormField
              control={form.control}
              name='R2ObjectPrefix'
              render={({ field }) => (
                <SettingsFormGridItem span='full'>
                  <FormItem>
                    <FormLabel>{t('Object prefix')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='media'
                        autoComplete='off'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Uploaded images are stored under this prefix.')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                </SettingsFormGridItem>
              )}
            />
          </SettingsFormGrid>
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
