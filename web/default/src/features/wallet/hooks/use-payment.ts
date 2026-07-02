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
import i18next from 'i18next'
import { useState, useCallback } from 'react'
import { toast } from 'sonner'

import {
  calculateAmount,
  calculateAlipayAmount,
  calculateStripeAmount,
  calculateWeChatPayAmount,
  calculateWaffoPancakeAmount,
  requestPayment,
  requestAlipayPayment,
  getOfficialPaymentStatus,
  requestStripePayment,
  requestWeChatPayPayment,
  isApiSuccess,
} from '../api'
import {
  isOfficialAlipayPayment,
  isOfficialWeChatPayPayment,
  isStripePayment,
  isWaffoPancakePayment,
  submitHtmlPaymentForm,
  submitPaymentForm,
} from '../lib'

// ============================================================================
// Payment Hook
// ============================================================================

export function usePayment() {
  const [amount, setAmount] = useState<number>(0)
  const [calculating, setCalculating] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [qrPayment, setQrPayment] = useState<{
    qrCode: string
    iframeUrl?: string
    orderId?: string
    paymentType: string
  } | null>(null)

  // Calculate payment amount
  const calculatePaymentAmount = useCallback(
    async (topupAmount: number, paymentType: string) => {
      try {
        setCalculating(true)

        const isStripe = isStripePayment(paymentType)
        const isPancake = isWaffoPancakePayment(paymentType)
        const isAlipay = isOfficialAlipayPayment(paymentType)
        const isWeChatPay = isOfficialWeChatPayPayment(paymentType)
        const response = isStripe
          ? await calculateStripeAmount({ amount: topupAmount })
          : isAlipay
            ? await calculateAlipayAmount({ amount: topupAmount })
            : isWeChatPay
              ? await calculateWeChatPayAmount({ amount: topupAmount })
              : isPancake
                ? await calculateWaffoPancakeAmount({ amount: topupAmount })
                : await calculateAmount({ amount: topupAmount })

        if (isApiSuccess(response) && response.data) {
          const calculatedAmount = parseFloat(response.data)
          setAmount(calculatedAmount)
          return calculatedAmount
        }

        // Don't show error for calculation, just set to 0
        setAmount(0)
        return 0
      } catch (_error) {
        setAmount(0)
        return 0
      } finally {
        setCalculating(false)
      }
    },
    []
  )

  // Process payment
  const processPayment = useCallback(
    async (topupAmount: number, paymentType: string) => {
      try {
        setProcessing(true)

        const isStripe = isStripePayment(paymentType)
        const isAlipay = isOfficialAlipayPayment(paymentType)
        const isWeChatPay = isOfficialWeChatPayPayment(paymentType)
        const amount = Math.floor(topupAmount)

        const response = isStripe
          ? await requestStripePayment({
              amount,
              payment_method: 'stripe',
            })
          : isAlipay
            ? await requestAlipayPayment({
                amount,
                payment_method: paymentType,
              })
            : isWeChatPay
              ? await requestWeChatPayPayment({
                  amount,
                  payment_method: paymentType,
                })
              : await requestPayment({
                  amount,
                  payment_method: paymentType,
                })

        if (!isApiSuccess(response)) {
          toast.error(response.message || i18next.t('Payment request failed'))
          return false
        }

        // Handle Stripe payment
        if (isStripe && response.data) {
          const data = response.data as { pay_link?: string }
          if (data.pay_link) {
            window.open(data.pay_link, '_blank')
            toast.success(i18next.t('Redirecting to payment page...'))
            return true
          }
        }

        if ((isAlipay || isWeChatPay) && response.data) {
          const data = response.data as {
            pay_form?: string
            pay_url?: string
            qr_code?: string
            order_id?: string
          }
          if (data.pay_form) {
            submitHtmlPaymentForm(data.pay_form)
            toast.success(i18next.t('Redirecting to payment page...'))
            return true
          }
          if (data.pay_url) {
            if (isAlipay) {
              setQrPayment({
                qrCode: '',
                iframeUrl: data.pay_url,
                orderId: data.order_id,
                paymentType,
              })
              toast.success(i18next.t('Scan QR code to pay'))
              return true
            }
            window.open(data.pay_url, '_blank')
            toast.success(i18next.t('Redirecting to payment page...'))
            return true
          }
          if (data.qr_code) {
            setQrPayment({
              qrCode: data.qr_code,
              orderId: data.order_id,
              paymentType,
            })
            toast.success(i18next.t('Scan QR code to pay'))
            return true
          }
        }

        // Handle non-Stripe payment
        if (!isStripe && response.data) {
          const url = (response as unknown as { url?: string }).url
          if (url) {
            submitPaymentForm(url, response.data)
            toast.success(i18next.t('Redirecting to payment page...'))
            return true
          }
        }

        return false
      } catch (_error) {
        toast.error(i18next.t('Payment request failed'))
        return false
      } finally {
        setProcessing(false)
      }
    },
    []
  )

  const clearQrPayment = useCallback(() => setQrPayment(null), [])

  const checkQrPaymentStatus = useCallback(async () => {
    if (!qrPayment?.orderId) {
      return null
    }

    const response = await getOfficialPaymentStatus(
      qrPayment.orderId,
      qrPayment.paymentType
    )
    if (isApiSuccess(response) && response.data) {
      return response.data
    }
    if (response.message) {
      throw new Error(response.message)
    }
    return null
  }, [qrPayment])

  return {
    amount,
    calculating,
    processing,
    calculatePaymentAmount,
    processPayment,
    setAmount,
    qrPayment,
    clearQrPayment,
    checkQrPaymentStatus,
  }
}
