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
import { cn } from '@/lib/utils'

type DiscountedPriceProps = {
  original: string
  discounted: string
  discountedEnabled: boolean
  adjustmentType?: 'discount' | 'increase' | null
  className?: string
  originalClassName?: string
  discountedClassName?: string
}

export function DiscountedPrice({
  original,
  discounted,
  discountedEnabled,
  adjustmentType,
  className,
  originalClassName,
  discountedClassName,
}: DiscountedPriceProps) {
  if (!discountedEnabled) {
    return <span className={cn(className, discountedClassName)}>{discounted}</span>
  }

  return (
    <span className={cn('inline-flex items-baseline gap-1.5', className)}>
      <span
        className={cn(
          'text-muted-foreground/50 line-through decoration-muted-foreground/60',
          originalClassName
        )}
      >
        {original}
      </span>
      <span
        className={cn(
          discountedClassName,
          adjustmentType === 'increase'
            ? 'text-rose-700 dark:text-rose-300'
            : 'text-emerald-700 dark:text-emerald-300'
        )}
      >
        {discounted}
      </span>
    </span>
  )
}
