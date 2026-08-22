import api, { type PaginatedResponse } from './client'
import { buildListQueryParams, type ListQueryParams } from '@/lib/listQuery'

export type RewriteAction = 'cname_rewrite' | string

export interface RewriteRuleItem {
  id: number
  name: string | null
  pattern: string
  action: RewriteAction
  params: Record<string, unknown>
  enabled: boolean
  created_at: number
  updated_at: number
}

export type ListParams = ListQueryParams

export async function listRewriteRules(params: ListParams = {}) {
  const { data } = await api.get<PaginatedResponse<RewriteRuleItem>>('/rewrite-rules', {
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

export async function getRewriteRule(id: number) {
  const { data } = await api.get<RewriteRuleItem>(`/rewrite-rules/${id}`)
  return data
}

export async function createRewriteRule(body: {
  name?: string | null
  pattern: string
  action: RewriteAction
  params: Record<string, unknown>
  enabled?: boolean
}) {
  const { data } = await api.post<RewriteRuleItem>('/rewrite-rules', body)
  return data
}

export async function updateRewriteRule(
  id: number,
  body: Partial<{
    name: string | null
    pattern: string
    action: RewriteAction
    params: Record<string, unknown>
    enabled: boolean
  }>
) {
  const { data } = await api.patch<RewriteRuleItem>(`/rewrite-rules/${id}`, body)
  return data
}

export async function deleteRewriteRule(id: number) {
  const { data } = await api.delete<{ ok?: boolean; id?: number }>(`/rewrite-rules/${id}`)
  return data
}

export async function setRewriteRulesEnabled(ids: number[], enabled: boolean) {
  const { data } = await api.patch<{ ok: boolean; updated: number; enabled: boolean }>(
    '/rewrite-rules/enabled',
    { ids, enabled }
  )
  return data
}
