import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, X } from 'lucide-react'
import {
  getRecord,
  listRecords,
  createRecord,
  createRecordValue,
  updateRecordValue,
  deleteRecordValue,
  promoteRecords,
  valueToString,
  type RecordValueItem,
} from '@/api/records'
import {
  externalResolverLookup,
  formatRemaining,
  type ExternalLookupResult,
} from '@/api/external-resolvers'
import { getSystemSettings } from '@/api/settings'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ResolveExternalModalProps {
  open: boolean
  domain: string
  recordId: number
  resolverId: number
  resolverName: string
  remaining: number
  onClose: () => void
  onApplied: () => void
  onQuotaConsumed: (n?: number) => void
}

type ValuesByType = { a: string[]; aaaa: string[]; cnames: string[] }

type CnameTargetState = {
  domain: string
  depth: number
  recordId: number | null
  autoCreated: boolean
  createFailed?: string
  current: ValuesByType
  resolvedA: string[]
  furtherCnames: string[]
  stopReason?: 'quota' | 'limit_error' | 'max_depth' | 'cycle' | 'no_a' | 'error'
}

const MAX_CNAME_DEPTH = 8

function valueList(v: unknown): string[] {
  if (v == null) return []
  if (Array.isArray(v)) {
    return v.map((x) => (typeof x === 'string' ? x : valueToString(x))).filter(Boolean)
  }
  const s = valueToString(v)
  return s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []
}

function currentByType(values: RecordValueItem[]): ValuesByType {
  const a: string[] = []
  const aaaa: string[] = []
  const cnames: string[] = []
  for (const row of values) {
    const t = String(row.type).toUpperCase()
    const parts = valueList(row.value)
    if (t === 'A') a.push(...parts)
    else if (t === 'AAAA') aaaa.push(...parts)
    else if (t === 'CNAME') cnames.push(...parts)
  }
  return {
    a: [...new Set(a)],
    aaaa: [...new Set(aaaa)],
    cnames: [...new Set(cnames)],
  }
}

function normalizeHost(host: string): string {
  return host.replace(/\.$/, '').toLowerCase().trim()
}

function isLimitError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('limit') ||
    m.includes('quota') ||
    m.includes('rate') ||
    m.includes('exceed') ||
    m.includes('too many') ||
    m.includes('throttle') ||
    m.includes('429') ||
    m.includes('daily') ||
    m.includes('no api keys')
  )
}

function normalizeFilterSet(ips: string[]): Set<string> {
  return new Set(ips.map((x) => x.trim().toLowerCase()).filter(Boolean))
}

function stripInvalid(values: string[], filterIps: Set<string>): string[] {
  return [...new Set(values.map((v) => v.trim()).filter((v) => v && !filterIps.has(v.toLowerCase())))]
}

async function findRecordByDomain(domain: string): Promise<{ id: number } | null> {
  const host = normalizeHost(domain)
  try {
    const data = await listRecords({
      page: 1,
      limit: 20,
      search: host,
      searchField: 'domain',
    })
    const exact = data.items.find((r) => normalizeHost(r.domain) === host)
    return exact ? { id: exact.id } : null
  } catch {
    return null
  }
}

export function ResolveExternalModal({
  open,
  domain,
  recordId,
  resolverId,
  resolverName,
  remaining,
  onClose,
  onApplied,
  onQuotaConsumed,
}: ResolveExternalModalProps) {
  const { t } = useTranslation()

  const [wantA, setWantA] = useState(true)
  const [wantAaaa, setWantAaaa] = useState(false)
  const [followCname, setFollowCname] = useState(true)

  const [running, setRunning] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState<'options' | 'results'>('options')

  const [current, setCurrent] = useState<ValuesByType>({ a: [], aaaa: [], cnames: [] })
  const [resolved, setResolved] = useState<ValuesByType>({ a: [], aaaa: [], cnames: [] })
  const [cnameTargets, setCnameTargets] = useState<CnameTargetState[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const [hitApiLimit, setHitApiLimit] = useState(false)
  const [filterIps, setFilterIps] = useState<Set<string>>(new Set())

  const [selA, setSelA] = useState<Set<string>>(new Set())
  const [selAaaa, setSelAaaa] = useState<Set<string>>(new Set())
  const [selCname, setSelCname] = useState<Set<string>>(new Set())
  const [selCnameA, setSelCnameA] = useState<Record<string, Set<string>>>({})

  const minCost = (wantA ? 1 : 0) + (wantAaaa ? 1 : 0)
  const hasResults =
    resolved.a.length + resolved.aaaa.length + resolved.cnames.length > 0 ||
    cnameTargets.some((c) => c.resolvedA.length > 0 || c.autoCreated)

  useEffect(() => {
    if (!open) return
    setWantA(true)
    setWantAaaa(false)
    setFollowCname(true)
    setRunning(false)
    setApplying(false)
    setError('')
    setPhase('options')
    setResolved({ a: [], aaaa: [], cnames: [] })
    setCnameTargets([])
    setLogs([])
    setHitApiLimit(false)
    setSelA(new Set())
    setSelAaaa(new Set())
    setSelCname(new Set())
    setSelCnameA({})
    ;(async () => {
      try {
        const data = await getRecord(recordId)
        setCurrent(currentByType(data.record.values ?? []))
      } catch {
        setCurrent({ a: [], aaaa: [], cnames: [] })
      }
      try {
        const settings = await getSystemSettings()
        setFilterIps(normalizeFilterSet(settings.cache?.filterIps ?? []))
      } catch {
        setFilterIps(new Set())
      }
    })()
  }, [open, recordId])

  const costHint = useMemo(() => {
    if (minCost === 0) return t('resolve.costNone')
    if (followCname) return t('resolve.costWithFollow', { n: minCost })
    return t('resolve.costExact', { n: minCost })
  }, [minCost, followCname, t])

  function toggle(set: Set<string>, value: string, setter: (s: Set<string>) => void) {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    setter(next)
  }

  function toggleCnameA(domainName: string, ip: string) {
    setSelCnameA((prev) => {
      const cur = new Set(prev[domainName] ?? [])
      if (cur.has(ip)) cur.delete(ip)
      else cur.add(ip)
      return { ...prev, [domainName]: cur }
    })
  }

  async function runResolve() {
    setError('')
    setHitApiLimit(false)
    if (!resolverId) {
      setError(t('resolve.noResolver'))
      return
    }
    if (minCost === 0) {
      setError(t('resolve.selectType'))
      return
    }
    if (Number.isFinite(remaining) && remaining <= 0) {
      setError(t('resolve.notEnoughQuota', { need: minCost, left: formatRemaining(remaining) }))
      return
    }

    setRunning(true)
    const log: string[] = []
    let used = 0
    let apiLimitHit = false
    const acc: ValuesByType = { a: [], aaaa: [], cnames: [] }
    const targets: CnameTargetState[] = []
    const selMap: Record<string, Set<string>> = {}

    async function one(cmd: 'a' | 'aaaa', host: string): Promise<ExternalLookupResult | null> {
      if (apiLimitHit) {
        log.push(t('resolve.stoppedApiLimit'))
        return null
      }
      if (Number.isFinite(remaining) && remaining - used < 1) {
        log.push(t('resolve.stoppedQuota'))
        return null
      }
      try {
        const res = await externalResolverLookup(resolverId, { domain: host, type: cmd })
        used += 1
        onQuotaConsumed(1)
        if (res.is_error) {
          log.push(`${cmd.toUpperCase()} ${host}: lookup reported error`)
        } else {
          log.push(`${cmd.toUpperCase()} ${host}: ok`)
        }
        return res
      } catch (err: unknown) {
        const msg =
          err &&
          typeof err === 'object' &&
          'response' in err &&
          (err as { response?: { data?: { error?: string } } }).response?.data?.error
        const text =
          typeof msg === 'string' ? msg : err instanceof Error ? err.message : String(err)
        if (isLimitError(text)) {
          apiLimitHit = true
          log.push(`${cmd.toUpperCase()} ${host}: ${t('resolve.apiLimitError')} (${text})`)
          return null
        }
        log.push(`${cmd.toUpperCase()} ${host}: ${text}`)
        return null
      }
    }

    async function settleCnameHop(
      cn: string,
      depth: number,
      resolvedA: string[],
      furtherCnames: string[],
      stopReason?: CnameTargetState['stopReason']
    ) {
      const existing = await findRecordByDomain(cn)
      if (existing) {
        let currentVals: ValuesByType = { a: [], aaaa: [], cnames: [] }
        try {
          const detail = await getRecord(existing.id)
          currentVals = currentByType(detail.record.values ?? [])
        } catch {
          /* ignore */
        }
        targets.push({
          domain: cn,
          depth,
          recordId: existing.id,
          autoCreated: false,
          current: currentVals,
          resolvedA,
          furtherCnames,
          stopReason,
        })
        if (resolvedA.length) selMap[cn] = new Set(resolvedA)
        log.push(t('resolve.cnameFoundExisting', { domain: cn }))
      } else if (resolvedA.length) {
        try {
          const created = await createRecord({
            domain: cn,
            enabled: true,
            values: [{ type: 'A', value: resolvedA }],
          })
          targets.push({
            domain: cn,
            depth,
            recordId: created.id,
            autoCreated: true,
            current: { a: [], aaaa: [], cnames: [] },
            resolvedA,
            furtherCnames,
            stopReason,
          })
          selMap[cn] = new Set()
          log.push(t('resolve.cnameAutoCreated', { domain: cn, ips: resolvedA.join(', ') }))
        } catch (err: unknown) {
          const msg =
            err &&
            typeof err === 'object' &&
            'response' in err &&
            (err as { response?: { data?: { error?: string } } }).response?.data?.error
          const errText = typeof msg === 'string' ? msg : t('common.error')
          targets.push({
            domain: cn,
            depth,
            recordId: null,
            autoCreated: false,
            createFailed: errText,
            current: { a: [], aaaa: [], cnames: [] },
            resolvedA,
            furtherCnames,
            stopReason,
          })
          log.push(t('resolve.cnameCreateFailed', { domain: cn, error: errText }))
        }
      } else {
        targets.push({
          domain: cn,
          depth,
          recordId: null,
          autoCreated: false,
          current: { a: [], aaaa: [], cnames: [] },
          resolvedA: [],
          furtherCnames,
          stopReason: stopReason ?? 'no_a',
        })
        if (stopReason === 'quota') log.push(t('resolve.cnameStoppedQuota', { domain: cn }))
        else if (stopReason === 'limit_error')
          log.push(t('resolve.cnameStoppedApiLimit', { domain: cn }))
        else if (stopReason === 'max_depth')
          log.push(t('resolve.cnameMaxDepth', { domain: cn, depth }))
        else if (stopReason === 'cycle') log.push(t('resolve.cnameCycle', { domain: cn }))
        else if (furtherCnames.length)
          log.push(t('resolve.cnameFurtherOnly', { domain: cn, next: furtherCnames.join(', ') }))
        else log.push(t('resolve.cnameNoA', { domain: cn }))
      }
    }

    try {
      if (wantA) {
        const res = await one('a', domain)
        if (res) {
          for (const x of res.a ?? []) if (!acc.a.includes(x)) acc.a.push(x)
          for (const x of res.cnames ?? []) if (!acc.cnames.includes(x)) acc.cnames.push(x)
        }
      }
      if (wantAaaa && !apiLimitHit) {
        const res = await one('aaaa', domain)
        if (res) {
          for (const x of res.aaaa ?? []) if (!acc.aaaa.includes(x)) acc.aaaa.push(x)
          for (const x of res.cnames ?? []) if (!acc.cnames.includes(x)) acc.cnames.push(x)
        }
      }

      if (followCname && acc.cnames.length && !apiLimitHit) {
        type QueueItem = { host: string; depth: number }
        const queue: QueueItem[] = acc.cnames.map((h) => ({ host: h, depth: 1 }))
        const visited = new Set<string>([normalizeHost(domain)])
        for (const h of acc.cnames) visited.add(normalizeHost(h))

        while (queue.length > 0) {
          if (apiLimitHit) {
            log.push(t('resolve.stoppedApiLimit'))
            break
          }
          if (Number.isFinite(remaining) && remaining - used < 1) {
            log.push(t('resolve.stoppedQuota'))
            while (queue.length > 0) {
              const left = queue.shift()!
              await settleCnameHop(left.host, left.depth, [], [], 'quota')
            }
            break
          }

          const { host: cn, depth } = queue.shift()!
          if (depth > MAX_CNAME_DEPTH) {
            await settleCnameHop(cn, depth, [], [], 'max_depth')
            continue
          }

          const res = await one('a', cn)
          if (apiLimitHit) {
            await settleCnameHop(cn, depth, [], [], 'limit_error')
            while (queue.length > 0) {
              const left = queue.shift()!
              await settleCnameHop(left.host, left.depth, [], [], 'limit_error')
            }
            break
          }
          if (!res) {
            await settleCnameHop(cn, depth, [], [], 'error')
            continue
          }

          const hopA = res.a ?? []
          const hopCnames = (res.cnames ?? [])
            .map(normalizeHost)
            .filter((c) => c && c !== normalizeHost(cn))

          if (hopA.length > 0) {
            await settleCnameHop(cn, depth, hopA, hopCnames)
            for (const next of hopCnames) {
              const key = normalizeHost(next)
              if (visited.has(key) || depth >= MAX_CNAME_DEPTH) continue
              visited.add(key)
              queue.push({ host: next, depth: depth + 1 })
            }
          } else if (hopCnames.length > 0) {
            const nextDepth = depth + 1
            if (nextDepth > MAX_CNAME_DEPTH) {
              await settleCnameHop(cn, depth, [], hopCnames, 'max_depth')
              continue
            }
            await settleCnameHop(cn, depth, [], hopCnames)
            for (const next of hopCnames) {
              const key = normalizeHost(next)
              if (visited.has(key)) {
                log.push(t('resolve.cnameCycle', { domain: next }))
                continue
              }
              visited.add(key)
              queue.push({ host: next, depth: nextDepth })
            }
          } else {
            await settleCnameHop(cn, depth, [], [], 'no_a')
          }
        }
      }

      setResolved(acc)
      setCnameTargets(targets)
      setSelA(new Set(acc.a))
      setSelAaaa(new Set(acc.aaaa))
      setSelCname(new Set(acc.cnames))
      setSelCnameA(selMap)
      setLogs(log)
      setHitApiLimit(apiLimitHit)
      setPhase('results')
    } finally {
      setRunning(false)
    }
  }

  /**
   * Merge selected into existing local (null dns_server_id) row, strip empty + filter IPs.
   * Delete the value row if nothing remains.
   */
  async function upsertMerged(
    targetRecordId: number,
    existingValues: RecordValueItem[],
    type: 'A' | 'AAAA' | 'CNAME',
    selected: string[]
  ) {
    const cleanedSelected = stripInvalid(selected, type === 'CNAME' ? new Set() : filterIps)
    const existing = existingValues.find(
      (v) =>
        String(v.type).toUpperCase() === type &&
        (v.dns_server_id == null || v.dns_server_id === undefined)
    )
    const prev = existing ? valueList(existing.value) : []
    const merged = stripInvalid([...prev, ...cleanedSelected], type === 'CNAME' ? new Set() : filterIps)

    if (!merged.length) {
      if (existing) await deleteRecordValue(targetRecordId, existing.id)
      return
    }
    if (existing) {
      await updateRecordValue(targetRecordId, existing.id, { type, value: merged })
    } else if (cleanedSelected.length) {
      await createRecordValue(targetRecordId, { type, value: merged })
    }
  }

  /** True if this value row is empty or only contains filter IPs. */
  function isInvalidValueRow(v: RecordValueItem): boolean {
    const parts = valueList(v.value)
    if (parts.length === 0) return true
    const type = String(v.type).toUpperCase()
    if (type === 'CNAME') return false
    return parts.every((p) => filterIps.has(p.toLowerCase()))
  }

  /**
   * Remove empty / filter-IP-only rows (including upstream FILTERED null rows)
   * after accepting external resolver results.
   */
  async function removeInvalidValues(
    targetRecordId: number,
    existingValues: RecordValueItem[]
  ) {
    for (const v of existingValues) {
      if (!isInvalidValueRow(v)) continue
      try {
        await deleteRecordValue(targetRecordId, v.id)
      } catch {
        /* best-effort */
      }
    }
  }

  async function applySelected() {
    setError('')
    setApplying(true)
    try {
      const data = await getRecord(recordId)
      const values = data.record.values ?? []
      const promoteIds = new Set<number>([recordId])

      await upsertMerged(recordId, values, 'A', [...selA])
      await upsertMerged(recordId, values, 'AAAA', [...selAaaa])
      await upsertMerged(recordId, values, 'CNAME', [...selCname])

      // Re-load and drop empty / FILTERED-IP rows (e.g. upstream FILTERED with value null)
      try {
        const after = await getRecord(recordId)
        await removeInvalidValues(recordId, after.record.values ?? [])
      } catch {
        await removeInvalidValues(recordId, values)
      }

      for (const target of cnameTargets) {
        if (!target.recordId) continue
        promoteIds.add(target.recordId)
        if (target.autoCreated) {
          try {
            const detail = await getRecord(target.recordId)
            await removeInvalidValues(target.recordId, detail.record.values ?? [])
          } catch {
            /* ignore */
          }
          continue
        }
        const selected = [...(selCnameA[target.domain] ?? [])]
        if (!selected.length) continue
        let existingValues: RecordValueItem[] = []
        try {
          const detail = await getRecord(target.recordId)
          existingValues = detail.record.values ?? []
        } catch {
          existingValues = []
        }
        await upsertMerged(target.recordId, existingValues, 'A', selected)
        try {
          const after = await getRecord(target.recordId)
          await removeInvalidValues(target.recordId, after.record.values ?? [])
        } catch {
          await removeInvalidValues(target.recordId, existingValues)
        }
      }

      try {
        await promoteRecords([...promoteIds])
      } catch {
        /* promote best-effort */
      }

      onApplied()
      onClose()
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { data?: { error?: string } } }).response?.data?.error
      setError(typeof msg === 'string' ? msg : t('common.error'))
    } finally {
      setApplying(false)
    }
  }

  function requestClose() {
    if (running || applying) return
    if (phase === 'results' && hasResults) {
      if (!window.confirm(t('resolve.discardWarning'))) return
    }
    onClose()
  }

  if (!open) return null

  const canApply =
    selA.size > 0 ||
    selAaaa.size > 0 ||
    selCname.size > 0 ||
    cnameTargets.some(
      (c) => !c.autoCreated && c.recordId != null && (selCnameA[c.domain]?.size ?? 0) > 0
    )

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={requestClose} aria-hidden />
      <div
        role="dialog"
        aria-modal
        className="relative z-10 flex w-full max-w-2xl max-h-[90vh] flex-col rounded-xl border bg-card shadow-lg"
      >
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">{t('resolve.title', { name: resolverName })}</h2>
            <p className="text-sm text-muted-foreground font-mono mt-0.5 break-all">{domain}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('resolve.remaining', { n: formatRemaining(remaining) })}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={requestClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {hitApiLimit && (
            <p className="text-sm text-amber-600 dark:text-amber-400">{t('resolve.apiLimitBanner')}</p>
          )}

          {phase === 'options' && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={wantA} onChange={(e) => setWantA(e.target.checked)} />
                {t('resolve.lookupA')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={wantAaaa}
                  onChange={(e) => setWantAaaa(e.target.checked)}
                />
                {t('resolve.lookupAaaa')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={followCname}
                  onChange={(e) => setFollowCname(e.target.checked)}
                />
                {t('resolve.followCname')}
              </label>
              <p className="text-xs text-muted-foreground">{costHint}</p>
            </div>
          )}

          {phase === 'results' && (
            <div className="space-y-4">
              {(['a', 'aaaa', 'cnames'] as const).map((kind) => {
                const label =
                  kind === 'a' ? 'A' : kind === 'aaaa' ? 'AAAA' : 'CNAME'
                const list = resolved[kind]
                const cur = current[kind]
                const sel = kind === 'a' ? selA : kind === 'aaaa' ? selAaaa : selCname
                const setSel = kind === 'a' ? setSelA : kind === 'aaaa' ? setSelAaaa : setSelCname
                if (!list.length && !cur.length) return null
                return (
                  <div key={kind} className="space-y-2">
                    <p className="text-sm font-medium">{label}</p>
                    <div className="grid gap-2 sm:grid-cols-2 text-xs">
                      <div>
                        <p className="text-muted-foreground mb-1">{t('resolve.current')}</p>
                        <ul className="space-y-1 font-mono">
                          {cur.length === 0 ? (
                            <li className="text-muted-foreground">—</li>
                          ) : (
                            cur.map((v) => <li key={v}>{v}</li>)
                          )}
                        </ul>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">{t('resolve.resolved')}</p>
                        <ul className="space-y-1 font-mono">
                          {list.length === 0 ? (
                            <li className="text-muted-foreground">—</li>
                          ) : (
                            list.map((v) => (
                              <li key={v}>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={sel.has(v)}
                                    onChange={() => toggle(sel, v, setSel)}
                                  />
                                  <span
                                    className={cn(
                                      filterIps.has(v.toLowerCase()) && 'text-destructive line-through'
                                    )}
                                  >
                                    {v}
                                  </span>
                                </label>
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                )
              })}

              {cnameTargets.length > 0 && (
                <div className="space-y-3 border-t pt-3">
                  <p className="text-sm font-medium">{t('resolve.cnameFollowTitle')}</p>
                  <p className="text-xs text-muted-foreground">{t('resolve.cnameFollowHint')}</p>
                  {cnameTargets.map((c) => (
                    <div key={`${c.domain}-${c.depth}`} className="rounded-md border p-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-mono font-medium">{c.domain}</span>
                        <span className="text-xs text-muted-foreground">
                          {t('resolve.depthBadge', { depth: c.depth })}
                        </span>
                        {c.autoCreated && (
                          <span className="text-xs text-green-600">{t('resolve.autoCreatedBadge')}</span>
                        )}
                        {c.createFailed && (
                          <span className="text-xs text-destructive">{t('resolve.createFailedBadge')}</span>
                        )}
                      </div>
                      {c.resolvedA.length > 0 && !c.autoCreated && c.recordId != null && (
                        <ul className="space-y-1 font-mono text-xs">
                          {c.resolvedA.map((ip) => (
                            <li key={ip}>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selCnameA[c.domain]?.has(ip) ?? false}
                                  onChange={() => toggleCnameA(c.domain, ip)}
                                />
                                <span
                                  className={cn(
                                    filterIps.has(ip.toLowerCase()) && 'text-destructive line-through'
                                  )}
                                >
                                  {ip}
                                </span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      )}
                      {c.autoCreated && (
                        <p className="text-xs text-muted-foreground">
                          {t('resolve.cnameAutoCreatedHint', { ips: c.resolvedA.join(', ') })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {logs.length > 0 && (
                <div className="rounded-md bg-muted/50 p-3">
                  <ul className="text-xs font-mono space-y-0.5 text-muted-foreground">
                    {logs.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-4">
          <Button type="button" variant="outline" disabled={running || applying} onClick={requestClose}>
            {t('common.cancel')}
          </Button>
          {phase === 'options' ? (
            <Button type="button" disabled={running || minCost === 0} onClick={() => void runResolve()}>
              {running && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('resolve.run')}
            </Button>
          ) : (
            <Button type="button" disabled={applying || !canApply} onClick={() => void applySelected()}>
              {applying && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('resolve.apply')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
