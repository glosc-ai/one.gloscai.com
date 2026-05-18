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
import { ShieldCheck, Smartphone } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PAYMENT_TYPES } from '../constants'

interface PaymentQrDialogProps {
  open: boolean
  qrCode?: string
  iframeUrl?: string
  amount?: number
  orderId?: string
  paymentType?: string
  onOpenChange: (open: boolean) => void
}

export function PaymentQrDialog({
  open,
  qrCode,
  iframeUrl,
  amount,
  orderId,
  paymentType,
  onOpenChange,
}: PaymentQrDialogProps) {
  const { t } = useTranslation()
  const formattedAmount =
    typeof amount === 'number' && Number.isFinite(amount)
      ? amount.toFixed(2)
      : '--'
  const isAlipay =
    Boolean(iframeUrl) || paymentType === PAYMENT_TYPES.ALIPAY_OFFICIAL
  const isWeChatPay = paymentType === PAYMENT_TYPES.WECHAT_PAY_OFFICIAL
  const directPayUrl = iframeUrl || qrCode

  if (iframeUrl || qrCode) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='w-[calc(100vw-1rem)] overflow-hidden rounded-[10px] bg-[#050505] p-0 text-white ring-white/10 sm:w-[444px] sm:max-w-[444px] [&_[data-slot=dialog-close]]:text-white/70 [&_[data-slot=dialog-close]]:hover:bg-white/10 [&_[data-slot=dialog-close]]:hover:text-white'>
          <div className='px-5 pt-7 pb-5 text-center'>
            <DialogTitle className='text-2xl font-semibold tracking-normal text-white'>
              {t('Complete payment by scanning')}
            </DialogTitle>
            <div className='mt-7 text-sm text-white/55'>
              {t('Payment amount')}
            </div>
            <div className='mt-2 text-4xl leading-none font-bold tracking-normal text-white'>
              ¥{formattedAmount}
            </div>
          </div>

          <div className='border-t border-white/8 px-5 pt-6 pb-7'>
            <div className='relative'>
              <div
                className={cn(
                  'flex h-[52px] items-center justify-center rounded-lg border text-base font-semibold',
                  isWeChatPay
                    ? 'border-[#07c160] bg-[#06190f] text-[#07c160]'
                    : 'border-[#1677ff] bg-[#06111f] text-[#1677ff]'
                )}
              >
                {isWeChatPay ? t('WeChat Pay') : t('Alipay payment')}
              </div>
             
            </div>

            <div className='mt-6 rounded-xl border border-white/8 bg-[#080808] px-6 py-6'>
              <div className='mx-auto flex h-51 w-51 items-center justify-center overflow-hidden bg-white'>
                {iframeUrl ? (
                  <iframe
                    src={iframeUrl}
                    title={t('Alipay Official')}
                    className='h-51 w-51 border-0 bg-white'
                    referrerPolicy='no-referrer-when-downgrade'
                  />
                ) : (
                  <QRCodeSVG value={qrCode || ''} size={204} includeMargin />
                )}
              </div>
              <div className='mt-2 flex items-center justify-center gap-1.5 text-xs text-white/60'>
                <Smartphone className='size-3.5' />
                <span>{t('Waiting for scan payment...')}</span>
              </div>
              {directPayUrl && (
                <Button
                  type='button'
                  variant='outline'
                  className='mt-4 h-11 w-full rounded-lg border-white/15 bg-white/[0.07] text-sm font-semibold text-white hover:bg-white/[0.12] hover:text-white'
                  onClick={() =>
                    window.open(directPayUrl, '_blank', 'noopener,noreferrer')
                  }
                >
                  {t('No QR code visible? Open payment page')}
                </Button>
              )}
            </div>

            <div className='mt-6 flex items-center justify-center gap-2 text-xs text-white/45'>
              <ShieldCheck className='size-4 text-emerald-500' />
              <span>
                {isAlipay
                  ? t('Alipay official secure payment center')
                  : t('WeChat Pay official secure payment center')}
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('sm:max-w-[360px]')}>
        <DialogHeader>
          <DialogTitle>{t('Scan QR code to pay')}</DialogTitle>
          <DialogDescription>
            {t('Complete the payment, then close this dialog')}
          </DialogDescription>
        </DialogHeader>
        {qrCode ? (
          <div className='flex flex-col items-center gap-3 py-2'>
            <div className='bg-white p-3 ring-1 ring-black/10'>
              <QRCodeSVG value={qrCode} size={220} includeMargin />
            </div>
            {orderId && (
              <div className='text-muted-foreground w-full truncate text-center text-xs'>
                {orderId}
              </div>
            )}
          </div>
        ) : null}
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            {t('I have paid')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
