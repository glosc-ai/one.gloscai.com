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
import { api } from '@/lib/api'

import type {
  AutoAddVendorsRequest,
  AutoAddVendorsResponse,
  BatchDeleteVendorsResponse,
  BatchUpdateVendorStatusRequest,
  BatchUpdateVendorStatusResponse,
  GetVendorsParams,
  GetVendorsResponse,
  GetVendorResponse,
  SearchVendorsParams,
  Vendor,
} from './types'

/**
 * Get paginated list of vendors
 */
export async function getVendors(
  params: GetVendorsParams = {}
): Promise<GetVendorsResponse> {
  const res = await api.get('/api/vendors/', { params })
  return res.data
}

/**
 * Search vendors with a keyword
 */
export async function searchVendors(
  params: SearchVendorsParams
): Promise<GetVendorsResponse> {
  const res = await api.get('/api/vendors/search', { params })
  return res.data
}

/**
 * Get single vendor by ID
 */
export async function getVendor(id: number): Promise<GetVendorResponse> {
  const res = await api.get(`/api/vendors/${id}`)
  return res.data
}

/**
 * Create a new vendor
 */
export async function createVendor(
  data: Partial<Vendor>
): Promise<{ success: boolean; message?: string; data?: Vendor }> {
  const res = await api.post('/api/vendors/', data)
  return res.data
}

/**
 * Update an existing vendor
 */
export async function updateVendor(
  data: Partial<Vendor> & { id: number }
): Promise<{ success: boolean; message?: string; data?: Vendor }> {
  const res = await api.put('/api/vendors/', data)
  return res.data
}

/**
 * Delete a vendor
 */
export async function deleteVendor(
  id: number
): Promise<{ success: boolean; message?: string }> {
  const res = await api.delete(`/api/vendors/${id}`)
  return res.data
}

export async function batchUpdateVendorStatus(
  data: BatchUpdateVendorStatusRequest
): Promise<BatchUpdateVendorStatusResponse> {
  const res = await api.put('/api/vendors/batch_status', data)
  return res.data
}

export async function batchDeleteVendors(
  ids: number[]
): Promise<BatchDeleteVendorsResponse> {
  const res = await api.post('/api/vendors/batch_delete', { ids })
  return res.data
}

export async function removeUnusedVendors(): Promise<BatchDeleteVendorsResponse> {
  const res = await api.post('/api/vendors/remove_unused')
  return res.data
}

/**
 * Add vendors that match namespaces used by the current model catalog.
 */
export async function autoAddVendors(
  data: AutoAddVendorsRequest
): Promise<AutoAddVendorsResponse> {
  const res = await api.post('/api/vendors/auto_add', data)
  return res.data
}
