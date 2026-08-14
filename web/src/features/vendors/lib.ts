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
import type { GetVendorsParams, SearchVendorsParams } from './types'

/**
 * React Query cache keys for the vendors admin page.
 *
 * Kept independent from the models feature's `vendorsQueryKeys` so the two
 * pages can invalidate their own lists without coupling.
 */
export const vendorsPageQueryKeys = {
  all: ['vendors-admin'] as const,
  lists: () => [...vendorsPageQueryKeys.all, 'list'] as const,
  list: (filters: GetVendorsParams | SearchVendorsParams) =>
    [...vendorsPageQueryKeys.lists(), filters] as const,
}
