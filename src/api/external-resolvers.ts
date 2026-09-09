import api, { type PaginatedResponse } from './client'
import { buildListQueryParams, type ListQueryParams } from '@/lib/listQuery'

export type ExternalResolverProvider = 'mxtoolbox' | string
export type ExternalResolverMode =
  | 'manual_only'
  | 'filtered_only'
  | 'timeout'
  | 'all'
  | string

export interface ExternalResolverKey {
  id: number
  resolver_id: number
  api_key: string
  label: string | null
  priority: number
  enabled: boolean
  period_limit: number
  used_count: number
  remaining: number
  period_start: number | null
  period_ms: number
  last_error: string | null
  last_used_at: number | null
  created_at: number
  updated_at: number
}

export interface ExternalResolver {
  id: number
  provider: ExternalResolverProvider
  name: string
  mode: ExternalResolverMode
  enabled: boolean
  config: Record<string, unknown>
  created_at: number
  updated_at: number
  keys?: ExternalResolverKey[]
}

export type ListParams = ListQueryParams

/** Effective remaining for a key (period_limit 0 = unlimited). Uses local counters. */
export function keyRemaining(
  key: Pick<ExternalResolverKey, 'period_limit' | 'used_count' | 'remaining' | 'enabled'>
): number {
  if (!key.enabled) return 0
  const limit = Number(key.period_limit) || 0
  if (limit <= 0) return Number.POSITIVE_INFINITY
  // Always derive from used_count so multi-key sums stay correct.
  const used = Number(key.used_count) || 0
  return Math.max(0, limit - used)
}

/** Sum of remaining across all keys; Infinity if any unlimited enabled key. */
export function resolverRemaining(keys: ExternalResolverKey[] | undefined): number {
  if (!keys?.length) return 0
  let sum = 0
  let hasUnlimited = false
  for (const k of keys) {
    const r = keyRemaining(k)
    if (!Number.isFinite(r)) {
      hasUnlimited = true
      continue
    }
    sum += r
  }
  return hasUnlimited ? Number.POSITIVE_INFINITY : sum
}

export function formatRemaining(n: number): string {
  if (!Number.isFinite(n)) return '∞'
  return String(Math.max(0, Math.floor(n)))
}

export async function listExternalResolvers(params: ListParams = {}) {
  const { data } = await api.get<PaginatedResponse<ExternalResolver>>('/external-resolvers', {
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

export async function getExternalResolver(id: number) {
  const { data } = await api.get<ExternalResolver>(`/external-resolvers/${id}`)
  return data
}

export async function createExternalResolver(body: {
  provider: ExternalResolverProvider
  name: string
  mode?: ExternalResolverMode
  enabled?: boolean
  config?: Record<string, unknown>
}) {
  const { data } = await api.post<ExternalResolver>('/external-resolvers', body)
  return data
}

export async function updateExternalResolver(
  id: number,
  body: Partial<{
    name: string
    mode: ExternalResolverMode
    enabled: boolean
    config: Record<string, unknown>
  }>
) {
  const { data } = await api.patch<ExternalResolver>(`/external-resolvers/${id}`, body)
  return data
}

export async function deleteExternalResolver(id: number) {
  const { data } = await api.delete<{ ok: boolean; id: number }>(`/external-resolvers/${id}`)
  return data
}

export async function listExternalResolverKeys(resolverId: number) {
  const { data } = await api.get<{ data: ExternalResolverKey[] }>(
    `/external-resolvers/${resolverId}/keys`
  )
  return data.data ?? []
}

export async function createExternalResolverKey(
  resolverId: number,
  body: {
    api_key: string
    label?: string | null
    priority?: number
    enabled?: boolean
    period_limit?: number
    period_ms?: number
  }
) {
  const { data } = await api.post<ExternalResolverKey>(
    `/external-resolvers/${resolverId}/keys`,
    body
  )
  return data
}

export async function updateExternalResolverKey(
  resolverId: number,
  keyId: number,
  body: Partial<{
    api_key: string
    label: string | null
    priority: number
    enabled: boolean
    period_limit: number
    period_ms: number
  }>
) {
  const { data } = await api.patch<ExternalResolverKey>(
    `/external-resolvers/${resolverId}/keys/${keyId}`,
    body
  )
  return data
}

export async function deleteExternalResolverKey(resolverId: number, keyId: number) {
  const { data } = await api.delete<{ ok: boolean; id: number; resolver_id: number }>(
    `/external-resolvers/${resolverId}/keys/${keyId}`
  )
  return data
}

export async function resetExternalResolverKeyUsage(resolverId: number, keyId: number) {
  const { data } = await api.post<ExternalResolverKey>(
    `/external-resolvers/${resolverId}/keys/${keyId}/reset-usage`
  )
  return data
}

export interface ExternalLookupResult {
  provider: string
  resolver_id: number
  key_id: number
  domain: string
  type: 'a' | 'aaaa' | string
  a: string[]
  aaaa: string[]
  cnames: string[]
  raw?: unknown
  is_error?: boolean
}

export async function externalResolverLookup(
  resolverId: number,
  body: { domain: string; type?: 'a' | 'aaaa' }
) {
  const { data } = await api.post<ExternalLookupResult>(
    `/external-resolvers/${resolverId}/lookup`,
    body
  )
  return data
}

export async function syncExternalResolverUsage(resolverId: number) {
  const { data } = await api.post<{
    resolver_id: number
    provider: string
    results: Array<{
      key_id: number
      ok: boolean
      remaining?: number
      error?: string
      skipped?: boolean
      reason?: string
      key?: ExternalResolverKey
    }>
  }>(`/external-resolvers/${resolverId}/sync-usage`)
  return data
}
