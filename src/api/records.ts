import api, { type PaginatedResponse } from './client'
import { buildListQueryParams, type ListQueryParams } from '@/lib/listQuery'

/** Matches GET /api/records list item */
export interface RecordListItem {
  id: number
  domain: string
  enabled: boolean
  source: 'LOCAL' | 'CACHE' | 'FILTERED' | string
  hits: number
  last_hit: number | null
  created_at: number
  updated_at: number
}

/** Value row on detail */
export interface RecordValueItem {
  id: number
  type: string
  status: string
  value: unknown
  ttl: number | null
  selected: boolean
  is_stale: boolean
  last_success_at: number | null
  expires_at: number | null
  dns_server_id?: number | null
  dnsServer?: {
    id: number
    ip: string
    enabled: boolean
    priority: number
  } | null
}

export interface RecordDetail {
  id: number
  domain: string
  enabled: boolean
  source: string
  is_regex: boolean
  hits: number
  last_hit: number | null
  created_at: number
  updated_at: number
  values: RecordValueItem[]
}

export interface RecordDetailResponse {
  record: RecordDetail
  resolvedServers: Array<{
    id: number
    ip: string
    enabled: boolean
    priority: number
  }>
  cnameChain: Array<
    | (RecordDetail & { resolvedServers?: unknown[]; missing?: false })
    | { domain: string; missing: true; values: []; resolvedServers: [] }
  >
}

export type RecordValueType = 'A' | 'AAAA' | 'CNAME'

export interface CreateRecordValueInput {
  type: RecordValueType | string
  /** Backend expects a non-empty array (e.g. ["1.2.3.4"] or ["cdn.example.com"]). */
  value: string[]
  selected?: boolean
  ttl?: number | null
  dns_server_id?: number | null
}

/** Wrap a single UI string into the array shape the API requires. */
export function toValueArray(value: string): string[] {
  const v = value.trim()
  return v ? [v] : []
}

export type ListRecordsParams = ListQueryParams

export async function listRecords(params: ListRecordsParams = {}) {
  const { data } = await api.get<PaginatedResponse<RecordListItem>>('/records', {
    params: buildListQueryParams({
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      search: params.search,
      searchField: params.searchField,
      filters: params.filters,
      filterLogic: params.filterLogic,
      sortBy: params.sortBy,
      sortDir: params.sortDir,
    }),
  })
  return data
}

export async function getRecord(id: number) {
  const { data } = await api.get<RecordDetailResponse>(`/records/${id}`)
  return data
}

export async function createRecord(body: {
  domain: string
  enabled?: boolean
  values?: CreateRecordValueInput[]
}) {
  const { data } = await api.post<{ record: RecordDetail }>('/records', body)
  return data.record
}

export async function updateRecord(
  id: number,
  body: { domain?: string; enabled?: boolean }
) {
  const { data } = await api.patch<{ record: RecordDetail }>(`/records/${id}`, body)
  return data.record
}

export async function deleteRecord(id: number) {
  const { data } = await api.delete<{ ok: boolean; id: number }>(`/records/${id}`)
  return data
}

export async function setRecordsEnabled(ids: number[], enabled: boolean) {
  const { data } = await api.patch<{
    ok: boolean
    enabled: boolean
    requested: number
    updated: number
  }>('/records/enabled', { ids, enabled })
  return data
}

export async function promoteRecords(ids: number[]) {
  const { data } = await api.post<{
    ok: boolean
    requested: number
    promoted: number
  }>('/records/promote', { ids })
  return data
}

export async function demoteRecords(ids: number[]) {
  const { data } = await api.post<{
    ok: boolean
    requested: number
    demoted: number
  }>('/records/demote', { ids })
  return data
}

export async function createRecordValue(recordId: number, body: CreateRecordValueInput) {
  const { data } = await api.post<{ value: RecordValueItem }>(
    `/records/${recordId}/values`,
    body
  )
  return data.value
}

export async function updateRecordValue(
  recordId: number,
  valueId: number,
  body: Partial<CreateRecordValueInput>
) {
  const { data } = await api.patch<{ value: RecordValueItem }>(
    `/records/${recordId}/values/${valueId}`,
    body
  )
  return data.value
}

export async function deleteRecordValue(recordId: number, valueId: number) {
  await api.delete(`/records/${recordId}/values/${valueId}`)
}

/** Normalize API value field to display string */
export function valueToString(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(valueToString).filter(Boolean).join(', ')
  if (typeof value === 'object' && value !== null && 'data' in value) {
    return valueToString((value as { data: unknown }).data)
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}
