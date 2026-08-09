import api, { type PaginatedResponse } from './client'

export interface LogFileItem {
  name: string
  size: number
  mtime: number
  current: boolean
}

export interface LogFileDetail {
  name: string
  current: boolean
  lines: string[]
  meta: {
    mode: 'tail' | 'range' | string
    lines?: number
    offset?: number
    limit?: number
    from: number
    to: number
    total: number
  }
}

export async function listLogFiles(params: { page?: number; limit?: number } = {}) {
  const { data } = await api.get<PaginatedResponse<LogFileItem>>('/logs', {
    params: { page: params.page ?? 1, limit: params.limit ?? 20 },
  })
  return data
}

/** Tail last N lines (default backend 200, max 2000). */
export async function getLogFileTail(filename: string, lines = 200) {
  const { data } = await api.get<LogFileDetail>(`/logs/${encodeURIComponent(filename)}`, {
    params: { lines },
  })
  return data
}

/** Range from start via page/limit. */
export async function getLogFileRange(
  filename: string,
  params: { page?: number; limit?: number; offset?: number } = {}
) {
  const { data } = await api.get<LogFileDetail>(`/logs/${encodeURIComponent(filename)}`, {
    params,
  })
  return data
}
