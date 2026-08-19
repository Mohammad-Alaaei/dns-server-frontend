import { useCallback, useEffect, useState } from 'react'
import { fetchMxUsage, mxRemaining, type MxUsage } from '@/api/mxtoolbox'
import { getSystemSettings } from '@/api/settings'
import { getMxtoolboxApiKey, setMxtoolboxApiKey } from '@/lib/mxtoolboxKey'

/**
 * Shared MXToolbox DNS quota for the session.
 * Fetches usage once (when apiKey is available), then decrements locally after each lookup.
 */
let cachedUsage: MxUsage | null = null
let cachedKey: string | null = null
let inflight: Promise<MxUsage | null> | null = null
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((l) => l())
}

export async function ensureMxUsage(apiKey: string): Promise<MxUsage | null> {
  if (!apiKey.trim()) {
    cachedUsage = null
    cachedKey = null
    notify()
    return null
  }
  if (cachedUsage && cachedKey === apiKey) return cachedUsage
  if (inflight) return inflight

  inflight = (async () => {
    try {
      const usage = await fetchMxUsage(apiKey)
      cachedUsage = usage
      cachedKey = apiKey
      notify()
      return usage
    } catch {
      cachedUsage = null
      cachedKey = apiKey
      notify()
      return null
    } finally {
      inflight = null
    }
  })()
  return inflight
}

export function consumeMxLookups(n: number) {
  if (!cachedUsage || n <= 0) return
  cachedUsage = {
    ...cachedUsage,
    DnsRequests: (Number(cachedUsage.DnsRequests) || 0) + n,
  }
  notify()
}

export function getCachedMxRemaining(): number {
  return mxRemaining(cachedUsage)
}

export function useMxtoolboxQuota(enabled: boolean) {
  const [apiKey, setApiKey] = useState('')
  const [usage, setUsage] = useState<MxUsage | null>(cachedUsage)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const refreshFromCache = useCallback(() => {
    setUsage(cachedUsage ? { ...cachedUsage } : null)
  }, [])

  useEffect(() => {
    listeners.add(refreshFromCache)
    return () => {
      listeners.delete(refreshFromCache)
    }
  }, [refreshFromCache])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        let key = getMxtoolboxApiKey()
        try {
          const settings = await getSystemSettings()
          const fromServer = settings.resolvers?.mxtoolbox?.apiKey?.trim() ?? ''
          if (fromServer) {
            key = fromServer
            setMxtoolboxApiKey(fromServer)
          }
        } catch {
          /* keep local key */
        }
        if (cancelled) return
        setApiKey(key)
        if (!key) {
          setUsage(null)
          return
        }
        const u = await ensureMxUsage(key)
        if (!cancelled) setUsage(u ? { ...u } : null)
      } catch {
        if (!cancelled) setError('Failed to load MXToolbox settings')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])

  return {
    apiKey,
    usage,
    remaining: mxRemaining(usage),
    loading,
    error,
    hasKey: !!apiKey.trim(),
  }
}
