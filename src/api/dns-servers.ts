import api, { type PaginatedResponse } from './client'
import { buildListQueryParams, type ListQueryParams } from '@/lib/listQuery'

export type DnsServerType = 'DEFAULT' | 'CUSTOM' | string

export interface DnsServerListItem {
  id: number
  ip: string
  type: DnsServerType
  enabled: boolean
  priority: number
  average_latency: number
  successes: number
  failures: number
  timeouts: number
}

export interface DnsServerDetail extends DnsServerListItem {}

export interface DnsRuleItem {
  id: number
  server_id: number
  domain: string
  is_regex: boolean
}

export type ListParams = ListQueryParams

export async function listDnsServers(params: ListParams = {}) {
  const { data } = await api.get<PaginatedResponse<DnsServerListItem>>('/dns-servers', {
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

export async function getDnsServer(id: number) {
  const { data } = await api.get<{ server: DnsServerDetail }>(`/dns-servers/${id}`)
  return data.server
}

export async function createDnsServer(body: {
  ip: string
  type: DnsServerType
  enabled?: boolean
  priority?: number
}) {
  const { data } = await api.post<{ server: DnsServerDetail }>('/dns-servers', body)
  return data.server
}

export async function updateDnsServer(
  id: number,
  body: Partial<{ ip: string; type: DnsServerType; enabled: boolean; priority: number }>
) {
  const { data } = await api.patch<{ server: DnsServerDetail }>(`/dns-servers/${id}`, body)
  return data.server
}

export async function deleteDnsServer(id: number) {
  const { data } = await api.delete<{ ok?: boolean; id?: number }>(`/dns-servers/${id}`)
  return data
}

export async function listDnsServerRules(serverId: number, params: ListParams = {}) {
  const { data } = await api.get<PaginatedResponse<DnsRuleItem>>(
    `/dns-servers/${serverId}/rules`,
    { params: { page: params.page ?? 1, limit: params.limit ?? 20 } }
  )
  return data
}

export async function createDnsServerRule(serverId: number, domain: string) {
  const { data } = await api.post<{ rule: DnsRuleItem }>(`/dns-servers/${serverId}/rules`, {
    domain,
  })
  return data.rule
}

export async function updateDnsRule(ruleId: number, domain: string) {
  const { data } = await api.patch<{ rule: DnsRuleItem }>(`/dns-servers/rules/${ruleId}`, {
    domain,
  })
  return data.rule
}

export async function deleteDnsRule(ruleId: number) {
  await api.delete(`/dns-servers/rules/${ruleId}`)
}
