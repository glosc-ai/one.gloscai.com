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
import { z } from 'zod'

/**
 * Vendor entity from API
 */
export interface Vendor {
  id: number
  name: string
  alias?: string
  description?: string
  icon?: string
  status: number
  created_time: number
  updated_time: number
}

/**
 * Get vendors list parameters
 */
export interface GetVendorsParams {
  p?: number
  page_size?: number
  status?: 0 | 1
  has_icon?: boolean
}

/**
 * Search vendors parameters
 */
export interface SearchVendorsParams extends GetVendorsParams {
  keyword?: string
}

/**
 * Paginated vendors response
 */
export interface GetVendorsResponse {
  success: boolean
  message?: string
  data?: {
    items: Vendor[]
    total: number
    page: number
    page_size: number
  }
}

/**
 * Single vendor response
 */
export interface GetVendorResponse {
  success: boolean
  message?: string
  data?: Vendor
}

/**
 * A compact LobeHub vendor candidate sent to the server for namespace matching.
 */
export interface AutoAddVendorCatalogItem {
  name: string
  alias?: string
  icon: string
  match_keys: string[]
}

export interface AutoAddVendorsRequest {
  catalog: AutoAddVendorCatalogItem[]
}

export interface AutoAddVendorsResult {
  scanned_model_count: number
  scanned_namespace_count: number
  created_count: number
  created_namespace_count: number
  existing_count: number
  unmatched_count: number
  ambiguous_count: number
  deleted_conflict_count: number
  created_vendors: Vendor[]
  created_namespaces: string[]
  existing_namespaces: string[]
  unmatched_namespaces: string[]
  ambiguous_namespaces: string[]
  deleted_conflict_namespaces: string[]
}

export interface AutoAddVendorsResponse {
  success: boolean
  message?: string
  data?: AutoAddVendorsResult
}

export interface BatchUpdateVendorStatusRequest {
  ids: number[]
  status: 0 | 1
}

export interface BatchUpdateVendorStatusResponse {
  success: boolean
  message?: string
  data?: {
    updated_count: number
  }
}

export interface BatchDeleteVendorsResponse {
  success: boolean
  message?: string
  data?: {
    deleted_count: number
  }
}

/**
 * Vendor form schema
 */
export const vendorFormSchema = z.object({
  id: z.number().optional(),
  name: z.string().trim().min(1, 'Vendor name is required'),
  alias: z.string().trim().default(''),
  description: z.string().default(''),
  icon: z.string().trim().default(''),
  status: z.number().default(1),
})

export type VendorFormInput = z.input<typeof vendorFormSchema>
export type VendorFormValues = z.output<typeof vendorFormSchema>
