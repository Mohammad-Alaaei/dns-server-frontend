/**
 * Diff form state vs loaded server values and call the right record value APIs.
 * Does not touch backend code — only uses existing frontend API helpers.
 */

import {
  createRecord,
  createRecordValue,
  updateRecordValue,
  deleteRecordValue,
  valueToString,
  type CreateRecordValueInput,
  type RecordValueItem,
} from '@/api/records'
import type {
  AddressGroup,
  CnameTargetDraft,
  RecordValuesState,
} from '@/components/records/RecordValueGroups'

export type LoadedValue = {
  id: number
  type: string
  dns_server_id: number | null
  value: string[]
  /** record this value belongs to (parent or child) */
  recordId: number
}

export function valueToStringList(value: unknown): string[] {
  if (value == null) return []
  if (Array.isArray(value)) {
    return value
      .map((x) => (typeof x === 'string' ? x : valueToString(x)))
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return valueToString(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function normList(list: string[]): string[] {
  return list.map((s) => s.trim()).filter(Boolean)
}

function sameList(a: string[], b: string[]): boolean {
  const aa = normList(a)
  const bb = normList(b)
  if (aa.length !== bb.length) return false
  return aa.every((v, i) => v === bb[i])
}

function serverKey(dns_server_id: number | null): string {
  return dns_server_id == null ? 'null' : String(dns_server_id)
}

/** Desired parent-level value rows derived from BOTH tabs (mixed domains). */
export function desiredParentValues(state: RecordValuesState): CreateRecordValueInput[] {
  const out: CreateRecordValueInput[] = []

  for (const g of state.addressGroups) {
    const a = normList(g.a)
    const aaaa = normList(g.aaaa)
    if (a.length) {
      out.push({
        type: 'A',
        value: a,
        dns_server_id: g.dns_server_id,
      })
    }
    if (aaaa.length) {
      out.push({
        type: 'AAAA',
        value: aaaa,
        dns_server_id: g.dns_server_id,
      })
    }
  }

  const cnames = state.cnames
    .map((c) => c.domain.trim().replace(/\.$/, ''))
    .filter(Boolean)
  if (cnames.length) {
    out.push({
      type: 'CNAME',
      value: cnames,
      dns_server_id: null,
    })
  }

  return out
}

function matchLoaded(
  loaded: LoadedValue[],
  type: string,
  dns_server_id: number | null
): LoadedValue | undefined {
  const t = type.toUpperCase()
  return loaded.find(
    (l) =>
      l.type.toUpperCase() === t &&
      serverKey(l.dns_server_id) === serverKey(dns_server_id ?? null)
  )
}

/**
 * Sync parent record values: POST / PATCH / DELETE as needed.
 * Returns list of human-readable errors (empty if all ok).
 */
export async function syncParentValues(
  recordId: number,
  state: RecordValuesState,
  loaded: LoadedValue[]
): Promise<string[]> {
  const errors: string[] = []
  const desired = desiredParentValues(state)
  const usedIds = new Set<number>()

  // CRITICAL: only match values that belong to THIS record.
  // loaded also contains cnameChain child host values (often type A/AAAA);
  // matching those would PATCH the wrong value id on the parent → 404.
  const parentLoaded = loaded.filter((l) => l.recordId === recordId)

  // Prefer DELETE of removed types first so unique (record_id, dns_server_id, type)
  // does not block POST when replacing CNAME with A (or the reverse).
  for (const l of parentLoaded) {
    const stillWanted = desired.some(
      (d) =>
        String(d.type).toUpperCase() === l.type.toUpperCase() &&
        serverKey(d.dns_server_id ?? null) === serverKey(l.dns_server_id)
    )
    if (stillWanted) continue
    try {
      await deleteRecordValue(recordId, l.id)
    } catch (err: unknown) {
      errors.push(apiError(err, `delete ${l.type}#${l.id}`))
    }
  }

  // Recompute remaining after deletes for safer matching
  const remaining = parentLoaded.filter((l) =>
    desired.some(
      (d) =>
        String(d.type).toUpperCase() === l.type.toUpperCase() &&
        serverKey(d.dns_server_id ?? null) === serverKey(l.dns_server_id)
    )
  )

  for (const d of desired) {
    const type = String(d.type).toUpperCase()
    const sid = d.dns_server_id ?? null
    const existing = matchLoaded(remaining, type, sid)
    try {
      if (existing) {
        usedIds.add(existing.id)
        const needValue = !sameList(existing.value, d.value)
        const needServer = serverKey(existing.dns_server_id) !== serverKey(sid)
        if (needValue || needServer) {
          await updateRecordValue(recordId, existing.id, {
            type,
            value: d.value,
            dns_server_id: sid,
          })
        }
      } else {
        await createRecordValue(recordId, {
          type,
          value: d.value,
          dns_server_id: sid,
        })
      }
    } catch (err: unknown) {
      errors.push(apiError(err, `${type} (server ${sid ?? 'local'})`))
    }
  }

  return errors
}

/** Sync one child host's A/AAAA from a CNAME target draft. */
export async function syncChildHost(
  target: CnameTargetDraft,
  loadedAll: LoadedValue[]
): Promise<string[]> {
  const errors: string[] = []
  const host = target.domain.trim().replace(/\.$/, '')
  if (!host) return errors

  const a = normList(target.a)
  const aaaa = normList(target.aaaa)
  // Nothing to write and no existing child → skip
  if (!a.length && !aaaa.length && target.recordId == null) return errors

  let childId = target.recordId

  if (childId == null) {
    if (!a.length && !aaaa.length) return errors
    try {
      const values: CreateRecordValueInput[] = []
      if (a.length) values.push({ type: 'A', value: a })
      if (aaaa.length) values.push({ type: 'AAAA', value: aaaa })
      const created = await createRecord({
        domain: host,
        enabled: true,
        values,
      })
      childId = created.id
      return errors
    } catch (err: unknown) {
      errors.push(apiError(err, `create host ${host}`))
      return errors
    }
  }

  const childLoaded = loadedAll.filter((l) => l.recordId === childId)
  const desired: CreateRecordValueInput[] = []
  if (a.length) desired.push({ type: 'A', value: a, dns_server_id: null })
  if (aaaa.length) desired.push({ type: 'AAAA', value: aaaa, dns_server_id: null })

  const usedIds = new Set<number>()
  for (const d of desired) {
    const existing = matchLoaded(childLoaded, String(d.type), null)
    try {
      if (existing) {
        usedIds.add(existing.id)
        if (!sameList(existing.value, d.value)) {
          await updateRecordValue(childId, existing.id, {
            type: d.type,
            value: d.value,
          })
        }
      } else {
        await createRecordValue(childId, {
          type: d.type,
          value: d.value,
        })
      }
    } catch (err: unknown) {
      errors.push(apiError(err, `${host} ${d.type}`))
    }
  }

  for (const l of childLoaded) {
    if (usedIds.has(l.id)) continue
    if (l.type.toUpperCase() === 'CNAME') continue // don't strip unrelated types on child
    const still = desired.some((d) => String(d.type).toUpperCase() === l.type.toUpperCase())
    if (still) continue
    try {
      await deleteRecordValue(childId, l.id)
    } catch (err: unknown) {
      errors.push(apiError(err, `delete ${host} ${l.type}#${l.id}`))
    }
  }

  return errors
}

export function extractLoadedValues(
  recordId: number,
  values: RecordValueItem[],
  cnameChain: Array<{
    id?: number
    domain?: string
    missing?: boolean
    values?: RecordValueItem[]
  }> = []
): LoadedValue[] {
  const out: LoadedValue[] = []

  for (const v of values ?? []) {
    out.push({
      id: v.id,
      type: String(v.type).toUpperCase(),
      dns_server_id:
        v.dns_server_id !== undefined && v.dns_server_id !== null
          ? v.dns_server_id
          : v.dnsServer?.id ?? null,
      value: valueToStringList(v.value),
      recordId,
    })
  }

  for (const item of cnameChain ?? []) {
    if (!item || item.missing || typeof item.id !== 'number') continue
    for (const v of item.values ?? []) {
      out.push({
        id: v.id,
        type: String(v.type).toUpperCase(),
        dns_server_id:
          v.dns_server_id !== undefined && v.dns_server_id !== null
            ? v.dns_server_id
            : v.dnsServer?.id ?? null,
        value: valueToStringList(v.value),
        recordId: item.id,
      })
    }
  }

  return out
}

function apiError(err: unknown, context: string): string {
  const msg =
    err &&
    typeof err === 'object' &&
    'response' in err &&
    (err as { response?: { data?: { error?: string } } }).response?.data?.error
  if (typeof msg === 'string' && msg) return `${context}: ${msg}`
  return `${context}: request failed`
}

// silence unused import warning helpers for AddressGroup if tree-shaken
export type { AddressGroup, CnameTargetDraft }
