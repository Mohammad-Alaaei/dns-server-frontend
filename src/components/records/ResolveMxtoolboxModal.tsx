import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, X } from 'lucide-react'
import {
  getRecord,
  listRecords,
  createRecord,
  createRecordValue,
  updateRecordValue,
  valueToString,
  type RecordValueItem,
} from '@/api/records'
import {
  mxLookup,
  parseMxInformation,
  type MxLookupResponse,
} from '@/api/mxtoolbox'
import { consumeMxLookups } from '@/hooks/useMxtoolboxQuota'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ResolveMxtoolboxModalProps {
  open: boolean
  domain: string
  recordId: number
  apiKey: string
  remaining: number
  onClose: () => void
  onApplied: () => void
  onQuotaConsumed: () => void
}

type ValuesByType = { a: string[]; aaaa: string[]; cnames: string[] }

type CnameTargetState = {
  domain: string
  /** Depth in the CNAME chain (1 = direct child of parent) */
  depth: number
  /** Existing record id, or id after auto-create; null if missing and no A to create */
  recordId: number | null
  autoCreated: boolean
  createFailed?: string
  current: ValuesByType
  resolvedA: string[]
  /** Further CNAME targets found at this hop (when we stopped before following them) */
  furtherCnames: string[]
  /** Why this hop did not produce terminal A records */
  stopReason?: 'quota' | 'limit_error' | 'max_depth' | 'cycle' | 'no_a' | 'error'
}

/** Max CNAME hops to follow (DNS resolvers typically stop around 8–10). */
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

/**
 * MXToolbox quota / rate-limit errors are unreliable from the Usage endpoint
 * (remaining can stay at a fixed value like 64 while the real budget is exhausted).
 * Detect limit-style failures from error messages so we can stop following CNAMEs.
 */
function isMxLimitError(message: string): boolean {
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
    m.includes('maximum') ||
    m.includes('allowed') ||
    m.includes('credits') ||
    m.includes('usage')
  )
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

export function ResolveMxtoolboxModal({
  open,
  domain,
  recordId,
  apiKey,
  remaining,
  onClose,
  onApplied,
  onQuotaConsumed,
}: ResolveMxtoolboxModalProps) {
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

  const [selA, setSelA] = useState<Set<string>>(new Set())
  const [selAaaa, setSelAaaa] = useState<Set<string>>(new Set())
  const [selCname, setSelCname] = useState<Set<string>>(new Set())
  /** selected A values per CNAME target domain */
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
    })()
  }, [open, recordId])

  const costHint = useMemo(() => {
    if (minCost === 0) return t('resolve.costNone')
    if (followCname) {
      return t('resolve.costWithFollow', { n: minCost })
    }
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
    if (!apiKey.trim()) {
      setError(t('resolve.noApiKey'))
      return
    }
    if (minCost === 0) {
      setError(t('resolve.selectType'))
      return
    }
    // Soft check only — Usage remaining can be wrong (fixed 64, etc.).
    // Hard stop happens on actual limit errors / local used count.
    if (remaining <= 0) {
      setError(t('resolve.notEnoughQuota', { need: minCost, left: remaining }))
      return
    }

    setRunning(true)
    const log: string[] = []
    let used = 0
    let apiLimitHit = false
    const acc: ValuesByType = { a: [], aaaa: [], cnames: [] }
    const targets: CnameTargetState[] = []
    const selMap: Record<string, Set<string>> = {}

    /**
     * Perform one MXToolbox lookup. Returns:
     * - response on success
     * - null on soft failure (network / parse)
     * - sets apiLimitHit when the API signals quota/rate limit (even if remaining looked fine)
     */
    async function one(cmd: 'a' | 'aaaa', host: string): Promise<MxLookupResponse | null> {
      if (apiLimitHit) {
        log.push(t('resolve.stoppedApiLimit'))
        return null
      }
      // Local budget: trust remaining only as a soft upper bound
      if (remaining - used < 1) {
        log.push(t('resolve.stoppedQuota'))
        return null
      }
      try {
        const res = await mxLookup(apiKey, cmd, host)
        used += 1
        consumeMxLookups(1)
        onQuotaConsumed()
        // Some error payloads still return 200 with IsError / Failed
        if (res.IsError || (Array.isArray(res.Failed) && res.Failed.length > 0)) {
          const failInfo = (res.Failed ?? [])
            .map((f) => f.Info || f.Name || '')
            .filter(Boolean)
            .join('; ')
          const combined = failInfo || 'lookup failed'
          if (isMxLimitError(combined)) {
            apiLimitHit = true
            log.push(`${cmd.toUpperCase()} ${host}: ${t('resolve.apiLimitError')} (${combined})`)
            return null
          }
          log.push(`${cmd.toUpperCase()} ${host}: ${combined}`)
          return null
        }
        log.push(`${cmd.toUpperCase()} ${host}: ok`)
        return res
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        if (isMxLimitError(msg)) {
          apiLimitHit = true
          log.push(`${cmd.toUpperCase()} ${host}: ${t('resolve.apiLimitError')} (${msg})`)
          return null
        }
        log.push(`${cmd.toUpperCase()} ${host}: ${msg}`)
        return null
      }
    }

    /** Process a CNAME hop: find/create record, push target state. */
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
          selMap[cn] = new Set() // already applied via create
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
        if (stopReason === 'quota') {
          log.push(t('resolve.cnameStoppedQuota', { domain: cn }))
        } else if (stopReason === 'limit_error') {
          log.push(t('resolve.cnameStoppedApiLimit', { domain: cn }))
        } else if (stopReason === 'max_depth') {
          log.push(t('resolve.cnameMaxDepth', { domain: cn, depth }))
        } else if (stopReason === 'cycle') {
          log.push(t('resolve.cnameCycle', { domain: cn }))
        } else if (furtherCnames.length) {
          log.push(
            t('resolve.cnameFurtherOnly', {
              domain: cn,
              next: furtherCnames.join(', '),
            })
          )
        } else {
          log.push(t('resolve.cnameNoA', { domain: cn }))
        }
      }
    }

    try {
      // --- Parent domain lookups ---
      if (wantA) {
        const res = await one('a', domain)
        if (res) {
          const p = parseMxInformation(res.Information)
          for (const x of p.a) if (!acc.a.includes(x)) acc.a.push(x)
          for (const x of p.cnames) if (!acc.cnames.includes(x)) acc.cnames.push(x)
        }
      }
      if (wantAaaa && !apiLimitHit) {
        const res = await one('aaaa', domain)
        if (res) {
          const p = parseMxInformation(res.Information)
          for (const x of p.aaaa) if (!acc.aaaa.includes(x)) acc.aaaa.push(x)
          for (const x of p.cnames) if (!acc.cnames.includes(x)) acc.cnames.push(x)
        }
      }

      // --- Recursive CNAME follow (BFS) ---
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
          if (remaining - used < 1) {
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

          const p = parseMxInformation(res.Information)
          const hopA = p.a
          const hopCnames = p.cnames
            .map(normalizeHost)
            .filter((c) => c && c !== normalizeHost(cn))

          if (hopA.length > 0) {
            // Terminal: found A records
            await settleCnameHop(cn, depth, hopA, hopCnames)
            for (const next of hopCnames) {
              const key = normalizeHost(next)
              if (visited.has(key)) continue
              if (depth >= MAX_CNAME_DEPTH) continue
              visited.add(key)
              queue.push({ host: next, depth: depth + 1 })
            }
          } else if (hopCnames.length > 0) {
            // Pure CNAME hop — follow further if budget allows
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

  async function applySelected() {
    setError('')
    setApplying(true)
    try {
      const data = await getRecord(recordId)
      const values = data.record.values ?? []

      async function upsert(
        targetRecordId: number,
        existingValues: RecordValueItem[],
        type: 'A' | 'AAAA' | 'CNAME',
        selected: string[]
      ) {
        if (!selected.length) return
        const existing = existingValues.find(
          (v) =>
            String(v.type).toUpperCase() === type &&
            (v.dns_server_id == null || v.dns_server_id === undefined)
        )
        if (existing) {
          const prev = valueList(existing.value)
          const merged = [...new Set([...prev, ...selected])]
          await updateRecordValue(targetRecordId, existing.id, { type, value: merged })
        } else {
          await createRecordValue(targetRecordId, { type, value: selected })
        }
      }

      // Parent domain
      await upsert(recordId, values, 'A', [...selA])
      await upsert(recordId, values, 'AAAA', [...selAaaa])
      await upsert(recordId, values, 'CNAME', [...selCname])

      // Existing CNAME targets (not auto-created — those already have values)
      for (const target of cnameTargets) {
        if (!target.recordId || target.autoCreated) continue
        const selected = [...(selCnameA[target.domain] ?? [])]
        if (!selected.length) continue
        let existingValues: RecordValueItem[] = []
        try {
          const detail = await getRecord(target.recordId)
          existingValues = detail.record.values ?? []
        } catch {
          existingValues = []
        }
        await upsert(target.recordId, existingValues, 'A', selected)
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
            <h2 className="text-lg font-semibold">{t('resolve.title')}</h2>
            <p className="text-sm text-muted-foreground font-mono mt-0.5 break-all">{domain}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={requestClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-md border bg-muted/40 px-2 py-1 tabular-nums">
              {t('resolve.remaining', { n: remaining })}
            </span>
            <span className="text-muted-foreground">{costHint}</span>
          </div>

          {phase === 'options' && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={wantA}
                  disabled={running}
                  onChange={(e) => setWantA(e.target.checked)}
                />
                {t('resolve.lookupA')}
                <span className="text-xs text-muted-foreground">(1)</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={wantAaaa}
                  disabled={running}
                  onChange={(e) => setWantAaaa(e.target.checked)}
                />
                {t('resolve.lookupAaaa')}
                <span className="text-xs text-muted-foreground">(1)</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={followCname}
                  disabled={running}
                  onChange={(e) => setFollowCname(e.target.checked)}
                />
                {t('resolve.followCname')}
                <span className="text-xs text-muted-foreground">(+1 {t('resolve.perCname')})</span>
              </label>
            </div>
          )}

          {phase === 'results' && (
            <div className="space-y-4">
              {hitApiLimit && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                  {t('resolve.apiLimitBanner')}
                </div>
              )}

              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {domain}
              </p>
              <CompareBlock
                title="A"
                current={current.a}
                resolved={resolved.a}
                selected={selA}
                onToggle={(v) => toggle(selA, v, setSelA)}
              />
              <CompareBlock
                title="AAAA"
                current={current.aaaa}
                resolved={resolved.aaaa}
                selected={selAaaa}
                onToggle={(v) => toggle(selAaaa, v, setSelAaaa)}
              />
              <CompareBlock
                title="CNAME"
                current={current.cnames}
                resolved={resolved.cnames}
                selected={selCname}
                onToggle={(v) => toggle(selCname, v, setSelCname)}
              />

              {cnameTargets.map((target) => (
                <div key={`${target.depth}-${target.domain}`} className="space-y-2 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium font-mono break-all">{target.domain}</p>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
                      {t('resolve.depthBadge', { depth: target.depth })}
                    </span>
                    {target.autoCreated && (
                      <span className="rounded bg-emerald-600/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                        {t('resolve.autoCreatedBadge')}
                      </span>
                    )}
                    {target.createFailed && (
                      <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                        {t('resolve.createFailedBadge')}
                      </span>
                    )}
                    {!target.autoCreated && target.recordId == null && !target.createFailed && (
                      <span className="text-[10px] text-muted-foreground">
                        {t('resolve.cnameNoRecord')}
                      </span>
                    )}
                    {target.stopReason === 'limit_error' && (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                        {t('resolve.limitBadge')}
                      </span>
                    )}
                    {target.stopReason === 'max_depth' && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {t('resolve.maxDepthBadge')}
                      </span>
                    )}
                    {target.stopReason === 'cycle' && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {t('resolve.cycleBadge')}
                      </span>
                    )}
                  </div>
                  {target.autoCreated ? (
                    <p className="text-xs text-muted-foreground">
                      {t('resolve.cnameAutoCreatedHint', {
                        ips: target.resolvedA.join(', ') || '—',
                      })}
                    </p>
                  ) : target.recordId != null && target.resolvedA.length > 0 ? (
                    <CompareBlock
                      title="A"
                      current={target.current.a}
                      resolved={target.resolvedA}
                      selected={selCnameA[target.domain] ?? new Set()}
                      onToggle={(v) => toggleCnameA(target.domain, v)}
                    />
                  ) : target.resolvedA.length > 0 ? (
                    <p className="text-xs font-mono">{target.resolvedA.join(', ')}</p>
                  ) : target.furtherCnames.length > 0 ? (
                    <p className="text-xs text-muted-foreground font-mono">
                      → {target.furtherCnames.join(', ')}
                    </p>
                  ) : null}
                  {target.createFailed && (
                    <p className="text-xs text-destructive">{target.createFailed}</p>
                  )}
                </div>
              ))}

              {logs.length > 0 && (
                <div className="rounded-md bg-muted/40 px-3 py-2 text-xs font-mono space-y-0.5 max-h-28 overflow-y-auto">
                  {logs.map((l, i) => (
                    <div key={i}>{l}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t px-5 py-3">
          <Button type="button" variant="outline" disabled={running || applying} onClick={requestClose}>
            {t('common.cancel')}
          </Button>
          {phase === 'options' ? (
            <Button type="button" disabled={running || remaining < 1} onClick={() => void runResolve()}>
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

function CompareBlock({
  title,
  current,
  resolved,
  selected,
  onToggle,
}: {
  title: string
  current: string[]
  resolved: string[]
  selected: Set<string>
  onToggle: (v: string) => void
}) {
  const { t } = useTranslation()
  if (!current.length && !resolved.length) return null
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="bg-muted/40 px-3 py-1.5 text-xs font-semibold font-mono">{title}</div>
      <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x">
        <div className="p-3 space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {t('resolve.current')}
          </p>
          {current.length === 0 ? (
            <p className="text-xs text-muted-foreground">—</p>
          ) : (
            current.map((v) => (
              <p key={v} className="text-xs font-mono break-all">
                {v}
              </p>
            ))
          )}
        </div>
        <div className="p-3 space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {t('resolve.resolved')}
          </p>
          {resolved.length === 0 ? (
            <p className="text-xs text-muted-foreground">—</p>
          ) : (
            resolved.map((v) => (
              <label
                key={v}
                className={cn(
                  'flex items-start gap-2 text-xs font-mono break-all cursor-pointer rounded px-1 py-0.5',
                  selected.has(v) && 'bg-primary/10'
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-3.5 w-3.5 accent-primary shrink-0"
                  checked={selected.has(v)}
                  onChange={() => onToggle(v)}
                />
                {v}
              </label>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
