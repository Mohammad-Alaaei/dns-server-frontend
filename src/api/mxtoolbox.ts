/** MXToolbox public API (browser → api.mxtoolbox.com). */

const BASE = 'https://api.mxtoolbox.com'

export interface MxUsage {
  DnsRequests: number
  DnsMax: number
  NetworkRequests: number
  NetworkMax: number
}

export interface MxInformationRow {
  Type?: string
  'Domain Name'?: string
  'Canonical Name'?: string
  'IP Address'?: string
  TTL?: string
  Asn?: string
  IsIpV6?: string
  [key: string]: unknown
}

export interface MxLookupResponse {
  Command?: string
  CommandArgument?: string
  IsError?: boolean
  Failed?: Array<{ ID?: number; Name?: string; Info?: string }>
  Information?: MxInformationRow[]
  Errors?: unknown[]
  [key: string]: unknown
}

export function mxRemaining(usage: MxUsage | null): number {
  if (!usage) return 0
  const max = Number(usage.DnsMax) || 0
  const used = Number(usage.DnsRequests) || 0
  return Math.max(0, max - used)
}

async function mxFetch<T>(path: string, apiKey: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'GET',
    headers: {
      Authorization: apiKey,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      if (body && typeof body === 'object' && 'Error' in body) {
        detail = String((body as { Error?: string }).Error)
      }
    } catch {
      /* ignore */
    }
    throw new Error(detail || `MXToolbox HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function fetchMxUsage(apiKey: string): Promise<MxUsage> {
  return mxFetch<MxUsage>('/api/v1/Usage', apiKey)
}

export async function mxLookup(
  apiKey: string,
  command: 'a' | 'aaaa',
  domain: string
): Promise<MxLookupResponse> {
  const arg = encodeURIComponent(domain.replace(/\.$/, ''))
  return mxFetch<MxLookupResponse>(`/api/v1/Lookup/${command}/?argument=${arg}`, apiKey)
}

export function parseMxInformation(info: MxInformationRow[] | undefined): {
  a: string[]
  aaaa: string[]
  cnames: string[]
} {
  const a: string[] = []
  const aaaa: string[] = []
  const cnames: string[] = []
  for (const row of info ?? []) {
    const type = String(row.Type ?? '').toUpperCase()
    if (type === 'A') {
      const ip = String(row['IP Address'] ?? '').trim()
      if (ip && !a.includes(ip)) a.push(ip)
    } else if (type === 'AAAA') {
      const ip = String(row['IP Address'] ?? '').trim()
      if (ip && !aaaa.includes(ip)) aaaa.push(ip)
    } else if (type === 'CNAME') {
      const cn = String(row['Canonical Name'] ?? '').trim().replace(/\.$/, '')
      if (cn && !cnames.includes(cn)) cnames.push(cn)
    }
  }
  return { a, aaaa, cnames }
}
