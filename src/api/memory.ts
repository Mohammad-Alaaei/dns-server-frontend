import api, { type PaginatedResponse } from './client'

export interface MemoryRecordItem {
  id: number | null
  domain: string
  enabled: boolean
  isRegex: boolean
  source: string
  hits: number
  lastHit: number | null
  createdAt: number | null
  updatedAt: number | null
  servers: unknown[]
}

export interface MemoryPendingItem {
  domain: string
  source: string
  isRegex: boolean
  hits: number
  lastHit: number | null
  dnsServerId: number | null
  A: unknown[]
  AAAA: unknown[]
  CNAME: unknown[]
}

/** Custom group entry in memory (rule domain + servers). */
export interface MemoryCustomGroup {
  domain?: string
  regex?: unknown
  servers?: Array<{
    id?: number
    ip?: string
    type?: string
    enabled?: boolean
    priority?: number
    average_latency?: number
    successes?: number
    failures?: number
    timeouts?: number
  }>
  [key: string]: unknown
}

export interface MemoryStoreResponse {
  exactRecords: PaginatedResponse<MemoryRecordItem>
  regexRecords: PaginatedResponse<MemoryRecordItem>
  defaultDnsServers: PaginatedResponse<Record<string, unknown>>
  customDnsServers: PaginatedResponse<MemoryCustomGroup | Record<string, unknown>>
}

export async function getMemoryStore(params: { page?: number; limit?: number } = {}) {
  const { data } = await api.get<MemoryStoreResponse>('/memory/store', {
    params: { page: params.page ?? 1, limit: params.limit ?? 20 },
  })
  return data
}

export async function getPendingCache(params: { page?: number; limit?: number } = {}) {
  const { data } = await api.get<PaginatedResponse<MemoryPendingItem>>('/memory/pending-cache', {
    params: { page: params.page ?? 1, limit: params.limit ?? 20 },
  })
  return data
}
