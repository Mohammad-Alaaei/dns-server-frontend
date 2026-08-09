import api, { type PaginatedResponse } from './client'

export interface StatisticsSummary {
  records: {
    total: number
    bySource: Record<string, number>
    enabled: number
    disabled: number
    totalHits: number
  }
  dnsServers: {
    total: number
    enabled: number
    byType: Record<string, number>
  }
  upstream: {
    successes: number
    failures: number
    timeouts: number
    avgLatencyMs: number
  }
  memory: {
    exactRecords: number
    regexRecords: number
    defaultDnsServers: number
    customDnsServers: number
    pendingCache: number
  }
  process: {
    uptimeSec: number
    pid: number
  }
}

export interface TopRecordItem {
  id: number
  domain: string
  enabled: boolean
  source: string
  hits: number
  last_hit: number | null
  updated_at: number | null
}

export interface TopRecordsResponse {
  by: 'hits' | 'last_hit' | string
  limit: number
  items: TopRecordItem[]
}

export interface StatsDnsServerItem {
  id: number
  ip: string
  type: string
  enabled: boolean
  priority: number
  average_latency: number
  successes: number
  failures: number
  timeouts: number
}

export async function getStatisticsSummary() {
  const { data } = await api.get<StatisticsSummary>('/statistics/summary')
  return data
}

export async function getTopRecords(params: { by?: 'hits' | 'last_hit'; limit?: number } = {}) {
  const { data } = await api.get<TopRecordsResponse>('/statistics/top-records', {
    params: { by: params.by ?? 'hits', limit: params.limit ?? 10 },
  })
  return data
}

export async function getStatsDnsServers(params: { page?: number; limit?: number } = {}) {
  const { data } = await api.get<PaginatedResponse<StatsDnsServerItem>>('/statistics/dns-servers', {
    params: { page: params.page ?? 1, limit: params.limit ?? 10 },
  })
  return data
}
