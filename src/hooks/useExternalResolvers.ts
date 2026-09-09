import { useCallback, useEffect, useState } from 'react'
import {
  getExternalResolver,
  listExternalResolvers,
  resolverRemaining,
  type ExternalResolver,
} from '@/api/external-resolvers'

export type ResolverOption = {
  id: number
  name: string
  provider: string
  mode: string
  remaining: number
  enabled: boolean
}

async function buildOption(row: {
  id: number
  name: string
  provider: string
  mode: string
  enabled: boolean
  keys?: Parameters<typeof resolverRemaining>[0]
}): Promise<ResolverOption> {
  // Always load keys from detail so remaining is the sum of every key.
  let keys = row.keys
  try {
    const full = await getExternalResolver(row.id)
    keys = full.keys ?? keys ?? []
  } catch {
    keys = keys ?? []
  }
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    mode: row.mode,
    remaining: resolverRemaining(keys),
    enabled: !!row.enabled,
  }
}

/**
 * Enabled external resolvers with remaining quota (sum of all API keys).
 * Used by Resolve-by menus on records list/detail.
 */
export function useExternalResolvers(enabled: boolean) {
  const [items, setItems] = useState<ResolverOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!enabled) {
      setItems([])
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await listExternalResolvers({
        page: 1,
        limit: 100,
        filters: [{ id: 'f', field: 'enabled', value: 'true' }],
        sortBy: 'name',
        sortDir: 'ASC',
      })
      const options = await Promise.all(data.items.map((row) => buildOption(row)))
      setItems(options)
    } catch {
      setError('Failed to load external resolvers')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void load()
  }, [load])

  /**
   * Re-fetch one resolver from API and update remaining (sum of all keys).
   * Prefer this over optimistic decrement so multi-key totals stay correct.
   */
  const refreshOne = useCallback(async (resolverId: number) => {
    if (!resolverId) return
    try {
      const full = await getExternalResolver(resolverId)
      const option = await buildOption(full)
      setItems((prev) => {
        const idx = prev.findIndex((r) => r.id === resolverId)
        if (idx < 0) {
          return full.enabled ? [...prev, option] : prev
        }
        const next = [...prev]
        if (!full.enabled) {
          next.splice(idx, 1)
          return next
        }
        next[idx] = option
        return next
      })
    } catch {
      /* keep previous remaining */
    }
  }, [])

  /** Optimistic local decrement, then optional server refresh. */
  function consume(resolverId: number, n = 1) {
    if (n <= 0) return
    setItems((prev) =>
      prev.map((r) => {
        if (r.id !== resolverId) return r
        if (!Number.isFinite(r.remaining)) return r
        return { ...r, remaining: Math.max(0, r.remaining - n) }
      })
    )
  }

  return {
    items,
    loading,
    error,
    reload: load,
    refreshOne,
    consume,
  }
}

export type { ExternalResolver }
