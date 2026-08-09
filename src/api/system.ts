import api from './client'

export type ReloadScope = 'all' | 'records' | 'dns-servers'

export interface FlushResult {
  ok: boolean
  pendingBefore: number
}

export interface ReloadResult {
  ok: boolean
  scope: ReloadScope
  exactRecords: number
  regexRecords: number
  defaultDnsServers: number
  customDnsServers: number
}

export async function flushCache() {
  const { data } = await api.post<FlushResult>('/system/flush')
  return data
}

export async function reloadMemory(scope: ReloadScope = 'all') {
  const { data } = await api.post<ReloadResult>('/system/reload', { scope })
  return data
}
