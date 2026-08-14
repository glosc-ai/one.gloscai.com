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
import {
  getModelDiscountPercent,
  getModelPriceAdjustmentType,
  hasModelDiscount,
} from '../lib/price'
import type { PricingModel } from '../types'

type ModelDiscountBadgeProps = {
  model: PricingModel
  className?: string
}

export function ModelDiscountBadge({
  model,
  className,
}: ModelDiscountBadgeProps) {
  const { t } = useTranslation()
  if (!hasModelDiscount(model)) return null

  const adjustmentType = getModelPriceAdjustmentType(model)
  const isIncrease = adjustmentType === 'increase'

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1',
        isIncrease
          ? 'bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-300'
          : 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300',
        className
      )}
      title={t(isIncrease ? 'Model price increase' : 'Model discount')}
    >
      {isIncrease ? '+' : '-'}
      {getModelDiscountPercent(model)}%
    </span>
  )
}
