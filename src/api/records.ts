import api, { type PaginatedResponse } from './client'

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

export interface ListRecordsParams {
  page?: number
  limit?: number
}

export async function listRecords(params: ListRecordsParams = {}) {
  const { data } = await api.get<PaginatedResponse<RecordListItem>>('/records', {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
    },
  })
  return data
}

export async function getRecord(id: number) {
  const { data } = await api.get<RecordDetailResponse>(`/records/${id}`)
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
