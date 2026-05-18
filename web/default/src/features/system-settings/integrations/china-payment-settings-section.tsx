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
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import { removeTrailingSlash } from './utils'

export interface ChinaPaymentSettingsValues {
  AlipayEnabled: boolean
  AlipayAppId: string
  AlipayPrivateKey: string
  AlipayPublicKey: string
  AlipayGateway: string
  AlipayProduct: string
  AlipayNotifyUrl: string
  AlipayReturnUrl: string
  AlipayUnitPrice: number
  AlipayMinTopUp: number
  WeChatPayEnabled: boolean
  WeChatPayAppId: string
  WeChatPayMchId: string
  WeChatPayApiV3Key: string
  WeChatPayMerchantSerialNo: string
  WeChatPayMerchantPrivateKey: string
  WeChatPayPlatformPublicKey: string
  WeChatPayPlatformSerialNo: string
  WeChatPayApiBase: string
  WeChatPayTradeType: string
  WeChatPayNotifyUrl: string
  WeChatPayReturnUrl: string
  WeChatPayUnitPrice: number
  WeChatPayMinTopUp: number
}

interface Props {
  defaultValues: ChinaPaymentSettingsValues
}

export function ChinaPaymentSettingsSection({ defaultValues }: Props) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [loading, setLoading] = useState(false)
  const form = useForm<ChinaPaymentSettingsValues>({ defaultValues })

  useEffect(() => {
    form.reset(defaultValues)
  }, [defaultValues, form])

  const handleSave = async () => {
    setLoading(true)
    try {
      const values = form.getValues()
      const options: Array<{ key: string; value: string | number | boolean }> = [
        { key: 'AlipayEnabled', value: values.AlipayEnabled },
        { key: 'AlipayAppId', value: values.AlipayAppId.trim() },
        {
          key: 'AlipayGateway',
          value:
            removeTrailingSlash(values.AlipayGateway.trim()) ||
            'https://openapi.alipay.com/gateway.do',
        },
        { key: 'AlipayProduct', value: values.AlipayProduct || 'page' },
        { key: 'AlipayNotifyUrl', value: values.AlipayNotifyUrl.trim() },
        { key: 'AlipayReturnUrl', value: values.AlipayReturnUrl.trim() },
        { key: 'AlipayUnitPrice', value: Number(values.AlipayUnitPrice || 0) },
        { key: 'AlipayMinTopUp', value: Number(values.AlipayMinTopUp || 0) },
        { key: 'WeChatPayEnabled', value: values.WeChatPayEnabled },
        { key: 'WeChatPayAppId', value: values.WeChatPayAppId.trim() },
        { key: 'WeChatPayMchId', value: values.WeChatPayMchId.trim() },
        {
          key: 'WeChatPayMerchantSerialNo',
          value: values.WeChatPayMerchantSerialNo.trim(),
        },
        {
          key: 'WeChatPayPlatformSerialNo',
          value: values.WeChatPayPlatformSerialNo.trim(),
        },
        {
          key: 'WeChatPayApiBase',
          value:
            removeTrailingSlash(values.WeChatPayApiBase.trim()) ||
            'https://api.mch.weixin.qq.com',
        },
        {
          key: 'WeChatPayTradeType',
          value: values.WeChatPayTradeType || 'NATIVE',
        },
        { key: 'WeChatPayNotifyUrl', value: values.WeChatPayNotifyUrl.trim() },
        { key: 'WeChatPayReturnUrl', value: values.WeChatPayReturnUrl.trim() },
        {
          key: 'WeChatPayUnitPrice',
          value: Number(values.WeChatPayUnitPrice || 0),
        },
        {
          key: 'WeChatPayMinTopUp',
          value: Number(values.WeChatPayMinTopUp || 0),
        },
      ]

      const alipayPrivateKey = values.AlipayPrivateKey.trim()
      const alipayPublicKey = values.AlipayPublicKey.trim()
      const wechatApiV3Key = values.WeChatPayApiV3Key.trim()
      const wechatMerchantPrivateKey = values.WeChatPayMerchantPrivateKey.trim()
      const wechatPlatformPublicKey = values.WeChatPayPlatformPublicKey.trim()

      if (alipayPrivateKey) {
        options.push({ key: 'AlipayPrivateKey', value: alipayPrivateKey })
      }
      if (alipayPublicKey) {
        options.push({ key: 'AlipayPublicKey', value: alipayPublicKey })
      }
      if (wechatApiV3Key) {
        options.push({ key: 'WeChatPayApiV3Key', value: wechatApiV3Key })
      }
      if (wechatMerchantPrivateKey) {
        options.push({
          key: 'WeChatPayMerchantPrivateKey',
          value: wechatMerchantPrivateKey,
        })
      }
      if (wechatPlatformPublicKey) {
        options.push({
          key: 'WeChatPayPlatformPublicKey',
          value: wechatPlatformPublicKey,
        })
      }

      for (const option of options) {
        await updateOption.mutateAsync(option)
      }
      toast.success(t('Updated successfully'))
    } catch {
      toast.error(t('Update failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <SettingsSection
      title={t('Alipay and WeChat Pay')}
      description={t('Configure official China payment gateways')}
    >
      <Alert>
        <AlertDescription className='text-xs'>
          {t(
            'Use official merchant credentials. Leave key fields blank unless rotating them.'
          )}
        </AlertDescription>
      </Alert>

      <div className='space-y-6'>
        <div className='space-y-4'>
          <div className='flex items-center justify-between gap-4 rounded-lg border p-4'>
            <div>
              <h4 className='font-medium'>{t('Alipay Official')}</h4>
              <p className='text-muted-foreground text-sm'>
                {t('Computer website, mobile website, and QR code payments')}
              </p>
            </div>
            <Switch
              checked={form.watch('AlipayEnabled')}
              onCheckedChange={(value) => form.setValue('AlipayEnabled', value)}
            />
          </div>

          <div className='grid gap-4 md:grid-cols-3'>
            <div className='grid gap-1.5'>
              <Label>{t('App ID')}</Label>
              <Input {...form.register('AlipayAppId')} />
            </div>
            <div className='grid gap-1.5'>
              <Label>{t('Gateway')}</Label>
              <Input {...form.register('AlipayGateway')} />
            </div>
            <div className='grid gap-1.5'>
              <Label>{t('Product')}</Label>
              <Select
                value={form.watch('AlipayProduct') || 'page'}
                onValueChange={(value) =>
                  form.setValue('AlipayProduct', value ?? 'page')
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('Select product')} />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    <SelectItem value='page'>{t('Computer website')}</SelectItem>
                    <SelectItem value='wap'>{t('Mobile website')}</SelectItem>
                    <SelectItem value='qrcode'>{t('QR code')}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className='grid gap-4 md:grid-cols-2'>
            <div className='grid gap-1.5'>
              <Label>{t('App private key')}</Label>
              <Textarea
                rows={4}
                className='font-mono text-xs'
                {...form.register('AlipayPrivateKey')}
              />
            </div>
            <div className='grid gap-1.5'>
              <Label>{t('Alipay public key')}</Label>
              <Textarea
                rows={4}
                className='font-mono text-xs'
                {...form.register('AlipayPublicKey')}
              />
            </div>
          </div>

          <div className='grid gap-4 md:grid-cols-4'>
            <div className='grid gap-1.5 md:col-span-2'>
              <Label>{t('Notify URL')}</Label>
              <Input
                placeholder='https://example.com/api/alipay/notify'
                {...form.register('AlipayNotifyUrl')}
              />
            </div>
            <div className='grid gap-1.5 md:col-span-2'>
              <Label>{t('Return URL')}</Label>
              <Input
                placeholder='https://example.com/console/topup'
                {...form.register('AlipayReturnUrl')}
              />
            </div>
            <div className='grid gap-1.5'>
              <Label>{t('Unit price')}</Label>
              <Input
                type='number'
                step='0.01'
                min={0}
                {...form.register('AlipayUnitPrice', { valueAsNumber: true })}
              />
            </div>
            <div className='grid gap-1.5'>
              <Label>{t('Minimum top-up (USD)')}</Label>
              <Input
                type='number'
                min={0}
                {...form.register('AlipayMinTopUp', { valueAsNumber: true })}
              />
            </div>
          </div>
        </div>

        <div className='space-y-4'>
          <div className='flex items-center justify-between gap-4 rounded-lg border p-4'>
            <div>
              <h4 className='font-medium'>{t('WeChat Pay Official')}</h4>
              <p className='text-muted-foreground text-sm'>
                {t('Native QR code and H5 payments')}
              </p>
            </div>
            <Switch
              checked={form.watch('WeChatPayEnabled')}
              onCheckedChange={(value) =>
                form.setValue('WeChatPayEnabled', value)
              }
            />
          </div>

          <div className='grid gap-4 md:grid-cols-3'>
            <div className='grid gap-1.5'>
              <Label>{t('App ID')}</Label>
              <Input {...form.register('WeChatPayAppId')} />
            </div>
            <div className='grid gap-1.5'>
              <Label>{t('Merchant ID')}</Label>
              <Input {...form.register('WeChatPayMchId')} />
            </div>
            <div className='grid gap-1.5'>
              <Label>{t('Trade type')}</Label>
              <Select
                value={form.watch('WeChatPayTradeType') || 'NATIVE'}
                onValueChange={(value) =>
                  form.setValue('WeChatPayTradeType', value ?? 'NATIVE')
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('Select trade type')} />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    <SelectItem value='NATIVE'>{t('Native QR code')}</SelectItem>
                    <SelectItem value='MWEB'>{t('H5 payment')}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className='grid gap-4 md:grid-cols-3'>
            <div className='grid gap-1.5'>
              <Label>{t('API v3 key')}</Label>
              <Input
                type='password'
                autoComplete='new-password'
                {...form.register('WeChatPayApiV3Key')}
              />
            </div>
            <div className='grid gap-1.5'>
              <Label>{t('Merchant certificate serial number')}</Label>
              <Input {...form.register('WeChatPayMerchantSerialNo')} />
            </div>
            <div className='grid gap-1.5'>
              <Label>{t('Platform certificate serial number')}</Label>
              <Input {...form.register('WeChatPayPlatformSerialNo')} />
            </div>
          </div>

          <div className='grid gap-4 md:grid-cols-2'>
            <div className='grid gap-1.5'>
              <Label>{t('Merchant private key')}</Label>
              <Textarea
                rows={4}
                className='font-mono text-xs'
                {...form.register('WeChatPayMerchantPrivateKey')}
              />
            </div>
            <div className='grid gap-1.5'>
              <Label>{t('Platform public key')}</Label>
              <Textarea
                rows={4}
                className='font-mono text-xs'
                {...form.register('WeChatPayPlatformPublicKey')}
              />
            </div>
          </div>

          <div className='grid gap-4 md:grid-cols-4'>
            <div className='grid gap-1.5 md:col-span-2'>
              <Label>{t('API base')}</Label>
              <Input {...form.register('WeChatPayApiBase')} />
            </div>
            <div className='grid gap-1.5'>
              <Label>{t('Unit price')}</Label>
              <Input
                type='number'
                step='0.01'
                min={0}
                {...form.register('WeChatPayUnitPrice', {
                  valueAsNumber: true,
                })}
              />
            </div>
            <div className='grid gap-1.5'>
              <Label>{t('Minimum top-up (USD)')}</Label>
              <Input
                type='number'
                min={0}
                {...form.register('WeChatPayMinTopUp', {
                  valueAsNumber: true,
                })}
              />
            </div>
            <div className='grid gap-1.5 md:col-span-2'>
              <Label>{t('Notify URL')}</Label>
              <Input
                placeholder='https://example.com/api/wechat-pay/notify'
                {...form.register('WeChatPayNotifyUrl')}
              />
            </div>
            <div className='grid gap-1.5 md:col-span-2'>
              <Label>{t('Return URL')}</Label>
              <Input
                placeholder='https://example.com/console/topup'
                {...form.register('WeChatPayReturnUrl')}
              />
            </div>
          </div>
        </div>
      </div>

      <Button type='button' onClick={handleSave} disabled={loading}>
        {loading ? t('Saving...') : t('Save China payment settings')}
      </Button>
    </SettingsSection>
  )
}
