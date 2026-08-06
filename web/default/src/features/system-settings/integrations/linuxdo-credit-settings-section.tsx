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

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

import {
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'

export interface LinuxDOCreditSettingsValues {
  LinuxDOCreditEnabled: boolean
  LinuxDOCreditGateway: string
  LinuxDOCreditClientID: string
  LinuxDOCreditSecret: string
  LinuxDOCreditUnitPrice: number
  LinuxDOCreditMinTopUp: number
}

interface Props {
  values: LinuxDOCreditSettingsValues
  onValueChange: <K extends keyof LinuxDOCreditSettingsValues>(
    key: K,
    value: LinuxDOCreditSettingsValues[K]
  ) => void
}

export function LinuxDOCreditSettingsSection(props: Props) {
  const { t } = useTranslation()

  return (
    <div className='space-y-6'>
      <div>
        <h3 className='text-lg font-medium'>{t('LINUX DO Credit')}</h3>
        <p className='text-muted-foreground text-sm'>
          {t('Accept LINUX DO Credit through its Epay-compatible API')}
        </p>
      </div>

      <Alert>
        <AlertTitle>{t('Callback URL')}</AlertTitle>
        <AlertDescription>
          {t(
            'Set the application callback URL to {{url}}. The payment amount is LDC, while the top-up amount is the balance credited to the user.',
            { url: '<ServerAddress>/api/user/linuxdo-credit/notify' }
          )}
        </AlertDescription>
      </Alert>

      <SettingsSwitchItem>
        <SettingsSwitchContent>
          <Label htmlFor='linuxdo-credit-enabled'>
            {t('Enable LINUX DO Credit')}
          </Label>
          <p className='text-muted-foreground text-sm'>
            {t('Show LINUX DO Credit as an independent wallet payment method')}
          </p>
        </SettingsSwitchContent>
        <Switch
          id='linuxdo-credit-enabled'
          checked={props.values.LinuxDOCreditEnabled}
          onCheckedChange={(value) =>
            props.onValueChange('LinuxDOCreditEnabled', value)
          }
        />
      </SettingsSwitchItem>

      <div className='grid gap-6 md:grid-cols-2'>
        <div className='grid gap-1.5'>
          <Label htmlFor='linuxdo-credit-gateway'>
            {t('Gateway endpoint')}
          </Label>
          <Input
            id='linuxdo-credit-gateway'
            placeholder='https://credit.linux.do/epay'
            value={props.values.LinuxDOCreditGateway}
            onChange={(event) =>
              props.onValueChange('LinuxDOCreditGateway', event.target.value)
            }
          />
          <p className='text-muted-foreground text-sm'>
            {t('Base URL of the LINUX DO Credit Epay-compatible gateway')}
          </p>
        </div>

        <div className='grid gap-1.5'>
          <Label htmlFor='linuxdo-credit-client-id'>{t('Client ID')}</Label>
          <Input
            id='linuxdo-credit-client-id'
            autoComplete='off'
            value={props.values.LinuxDOCreditClientID}
            onChange={(event) =>
              props.onValueChange('LinuxDOCreditClientID', event.target.value)
            }
          />
          <p className='text-muted-foreground text-sm'>
            {t('The pid issued by LINUX DO Credit')}
          </p>
        </div>

        <div className='grid gap-1.5'>
          <Label htmlFor='linuxdo-credit-secret'>{t('Client secret')}</Label>
          <Input
            id='linuxdo-credit-secret'
            type='password'
            autoComplete='new-password'
            placeholder={t('Enter new secret to update')}
            value={props.values.LinuxDOCreditSecret}
            onChange={(event) =>
              props.onValueChange('LinuxDOCreditSecret', event.target.value)
            }
          />
          <p className='text-muted-foreground text-sm'>
            {t('Leave blank unless rotating the secret')}
          </p>
        </div>

        <div className='grid gap-1.5'>
          <Label htmlFor='linuxdo-credit-min-topup'>
            {t('Minimum top-up balance')}
          </Label>
          <Input
            id='linuxdo-credit-min-topup'
            type='number'
            min={1}
            max={4000}
            step={1}
            value={props.values.LinuxDOCreditMinTopUp}
            onChange={(event) =>
              props.onValueChange(
                'LinuxDOCreditMinTopUp',
                Number(event.target.value)
              )
            }
          />
          <p className='text-muted-foreground text-sm'>
            {t('Minimum wallet balance amount users can purchase')}
          </p>
        </div>
      </div>

      <div className='grid max-w-xl gap-1.5'>
        <Label htmlFor='linuxdo-credit-unit-price'>
          {t('LDC to balance conversion ratio')}
        </Label>
        <Input
          id='linuxdo-credit-unit-price'
          type='number'
          min={0.000001}
          max={1000000}
          step='0.01'
          value={props.values.LinuxDOCreditUnitPrice}
          onChange={(event) =>
            props.onValueChange(
              'LinuxDOCreditUnitPrice',
              Number(event.target.value)
            )
          }
        />
        <p className='text-muted-foreground text-sm'>
          {t(
            'LDC charged for each unit of wallet balance. For example, 2 means 2 LDC buys 1 unit of balance.'
          )}
        </p>
      </div>
    </div>
  )
}
