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
import { Loader2, WandSparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'

interface AutoAddVendorsDialogProps {
  isLoading: boolean
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
  open: boolean
}

export function AutoAddVendorsDialog(props: AutoAddVendorsDialogProps) {
  const { t } = useTranslation()

  return (
    <ConfirmDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Auto Add Vendors')}
      desc={t(
        'Scan existing model namespaces and add only missing vendors matched from LobeHub. Existing vendors and model assignments will not be changed.'
      )}
      handleConfirm={props.onConfirm}
      isLoading={props.isLoading}
      confirmText={
        <>
          {props.isLoading ? (
            <Loader2 className='animate-spin' data-icon='inline-start' />
          ) : (
            <WandSparkles data-icon='inline-start' />
          )}
          {props.isLoading ? t('Adding vendors...') : t('Scan and Add')}
        </>
      }
    />
  )
}
