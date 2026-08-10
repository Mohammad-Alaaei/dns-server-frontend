import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Loader2 } from 'lucide-react'
import {
  createRecord,
  updateRecord,
  getRecord,
  valueToString,
  type RecordValueItem,
} from '@/api/records'
import { listDnsServers, type DnsServerListItem } from '@/api/dns-servers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { Loading } from '@/components/Loading'
import {
  RecordValueGroups,
  emptyValuesState,
  buildPrimaryValues,
  type RecordValuesState,
  type AddressGroup,
  type CnameTargetDraft,
  type ServerOption,
} from '@/components/records/RecordValueGroups'
import { clearWizard } from '@/lib/recordWizard'
import {
  extractLoadedValues,
  syncParentValues,
  syncChildHost,
  type LoadedValue,
} from '@/lib/recordValueSync'

function confirmDiscard(message: string): boolean {
  return window.confirm(message)
}

function newKey(prefix = 'k') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function valueToStringList(value: unknown): string[] {
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

type ChainItem = {
  id?: number
  domain?: string
  missing?: boolean
  values?: RecordValueItem[]
}

function parseDetailToValuesState(
  values: RecordValueItem[],
  cnameChain: ChainItem[] = []
): RecordValuesState {
  const state = emptyValuesState()

  // Group A/AAAA by dns_server_id
  const groupMap = new Map<string, AddressGroup>()
  function groupKey(dnsServerId: number | null | undefined) {
    return dnsServerId == null ? 'local' : `s_${dnsServerId}`
  }
  function ensureGroup(dnsServerId: number | null | undefined): AddressGroup {
    const k = groupKey(dnsServerId)
    let g = groupMap.get(k)
    if (!g) {
      g = {
        key: newKey('ag'),
        dns_server_id: dnsServerId ?? null,
        a: [],
        aaaa: [],
      }
      groupMap.set(k, g)
    }
    return g
  }

  const cnameDomains: string[] = []

  for (const v of values ?? []) {
    const type = String(v.type).toUpperCase()
    const parts = valueToStringList(v.value)
    const sid =
      v.dns_server_id !== undefined && v.dns_server_id !== null
        ? v.dns_server_id
        : v.dnsServer?.id ?? null

    if (type === 'A') {
      const g = ensureGroup(sid)
      g.a = [...g.a, ...parts]
    } else if (type === 'AAAA') {
      const g = ensureGroup(sid)
      g.aaaa = [...g.aaaa, ...parts]
    } else if (type === 'CNAME') {
      for (const d of parts) {
        const norm = d.replace(/\.$/, '')
        if (norm && !cnameDomains.includes(norm)) cnameDomains.push(norm)
      }
    }
  }

  // Build chain lookup domain → values
  const chainByDomain = new Map<string, ChainItem>()
  for (const item of cnameChain ?? []) {
    if (!item || item.missing || !item.domain) continue
    chainByDomain.set(item.domain.toLowerCase().replace(/\.$/, ''), item)
  }

  const cnames: CnameTargetDraft[] = cnameDomains.map((domain) => {
    const chain = chainByDomain.get(domain.toLowerCase())
    const a: string[] = []
    const aaaa: string[] = []
    for (const v of chain?.values ?? []) {
      const type = String(v.type).toUpperCase()
      const parts = valueToStringList(v.value)
      if (type === 'A') a.push(...parts)
      if (type === 'AAAA') aaaa.push(...parts)
    }
    return {
      key: newKey('c'),
      domain,
      a,
      aaaa,
      recordId: typeof chain?.id === 'number' ? chain.id : undefined,
    }
  })

  // Also include chain entries not listed in parent CNAME value (defensive)
  for (const [dom, item] of chainByDomain) {
    if (cnames.some((c) => c.domain.toLowerCase() === dom)) continue
    const a: string[] = []
    const aaaa: string[] = []
    for (const v of item.values ?? []) {
      const type = String(v.type).toUpperCase()
      const parts = valueToStringList(v.value)
      if (type === 'A') a.push(...parts)
      if (type === 'AAAA') aaaa.push(...parts)
    }
    cnames.push({
      key: newKey('c'),
      domain: item.domain ?? dom,
      a,
      aaaa,
      recordId: typeof item.id === 'number' ? item.id : undefined,
    })
  }

  state.addressGroups =
    groupMap.size > 0
      ? [...groupMap.values()]
      : [{ key: newKey('ag'), dns_server_id: null, a: [], aaaa: [] }]
  state.cnames = cnames

  const hasAddr = state.addressGroups.some(
    (g) => g.a.some(Boolean) || g.aaaa.some(Boolean)
  )
  const hasCname = state.cnames.some((c) => c.domain.trim())
  if (hasCname && !hasAddr) state.mode = 'cname'
  else if (hasAddr && !hasCname) state.mode = 'address'
  else if (hasCname) state.mode = 'cname'
  else state.mode = 'address'

  return state
}

export default function RecordFormPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id: idParam } = useParams<{ id: string }>()

  const editId = idParam && idParam !== 'new' ? Number(idParam) : null
  const isEdit = editId != null && Number.isFinite(editId) && editId > 0

  const [domain, setDomain] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [valuesState, setValuesState] = useState<RecordValuesState>(emptyValuesState)
  const [recordId, setRecordId] = useState<number | null>(isEdit ? editId : null)
  const [source, setSource] = useState('')
  const [servers, setServers] = useState<ServerOption[]>([])
  const [loadedValues, setLoadedValues] = useState<LoadedValue[]>([])
  const [successMsg, setSuccessMsg] = useState('')
  const [errorList, setErrorList] = useState<string[]>([])

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [baseline, setBaseline] = useState({ domain: '', enabled: true })

  const dirty = useMemo(() => {
    if (domain !== baseline.domain) return true
    if (enabled !== baseline.enabled) return true
    if (!isEdit) {
      if (valuesState.addressGroups.some((g) => g.a.some(Boolean) || g.aaaa.some(Boolean)))
        return true
      if (valuesState.cnames.some((c) => c.domain || c.a.some(Boolean) || c.aaaa.some(Boolean)))
        return true
    }
    return false
  }, [domain, enabled, baseline, valuesState, isEdit])

  const loadEdit = useCallback(async () => {
    if (!editId) return
    setLoading(true)
    setError('')
    try {
      const [data, serverPage] = await Promise.all([
        getRecord(editId),
        listDnsServers({ page: 1, limit: 100 }).catch(() => null),
      ])
      const r = data.record
      setDomain(r.domain)
      setEnabled(!!r.enabled)
      setSource(r.source)
      setRecordId(r.id)
      setBaseline({ domain: r.domain, enabled: !!r.enabled })
      setValuesState(
        parseDetailToValuesState(r.values ?? [], (data.cnameChain ?? []) as ChainItem[])
      )
      setLoadedValues(
        extractLoadedValues(r.id, r.values ?? [], (data.cnameChain ?? []) as ChainItem[])
      )
      setErrorList([])
      setSuccessMsg('')
      if (serverPage?.items) {
        setServers(
          serverPage.items.map((s: DnsServerListItem) => ({
            id: s.id,
            label: `${s.ip} (${s.type})`,
          }))
        )
      }
    } catch {
      setError(t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [editId, t])

  useEffect(() => {
    if (isEdit) void loadEdit()
  }, [isEdit, loadEdit])

  useEffect(() => {
    clearWizard()
  }, [])

  function handleBack() {
    if (dirty && !confirmDiscard(t('records.discardConfirm'))) return
    if (window.history.length > 1) navigate(-1)
    else navigate('/records')
  }

  function handleCancel() {
    if (dirty && !confirmDiscard(t('records.discardConfirm'))) return
    navigate('/records')
  }

  async function handleSubmit() {
    setError('')
    setErrorList([])
    setSuccessMsg('')
    if (!domain.trim()) {
      setError(t('records.domainRequired'))
      return
    }

    setSaving(true)
    try {
      const primaryValues = buildPrimaryValues(valuesState)

      if (!isEdit || recordId == null) {
        const created = await createRecord({
          domain: domain.trim(),
          enabled,
          values: primaryValues,
        })
        setRecordId(created.id)
        setBaseline({ domain: created.domain, enabled: !!created.enabled })

        const childErrors: string[] = []
        if (valuesState.mode === 'cname' || valuesState.cnames.some((c) => c.domain.trim())) {
          for (const c of valuesState.cnames) {
            const errs = await syncChildHost(c, [])
            childErrors.push(...errs)
          }
        }

        if (childErrors.length) {
          setErrorList(childErrors)
          setError(t('records.partialCreateError'))
          // still navigate? user asked show errors on edit; for create stay here
          setSaving(false)
          return
        }

        navigate(`/records/${created.id}`, {
          replace: true,
          state: { flashSuccess: t('records.createSuccess') },
        })
      } else {
        // 1) Parent domain / enabled
        try {
          const updated = await updateRecord(recordId, {
            domain: domain.trim(),
            enabled,
          })
          setDomain(updated.domain)
          setEnabled(!!updated.enabled)
          setBaseline({ domain: updated.domain, enabled: !!updated.enabled })
        } catch (err: unknown) {
          const msg =
            err &&
            typeof err === 'object' &&
            'response' in err &&
            (err as { response?: { data?: { error?: string } } }).response?.data?.error
          setError(typeof msg === 'string' ? msg : t('common.error'))
          setSaving(false)
          return
        }

        // 2) Sync parent values from BOTH tabs
        const parentErrors = await syncParentValues(recordId, valuesState, loadedValues)

        // 3) Sync / create CNAME target hosts (never delete host when dropped from list)
        const childErrors: string[] = []
        for (const c of valuesState.cnames) {
          const errs = await syncChildHost(c, loadedValues)
          childErrors.push(...errs)
        }

        const allErrors = [...parentErrors, ...childErrors]
        if (allErrors.length) {
          setErrorList(allErrors)
          setError(t('records.partialApplyError'))
          // refresh loaded snapshot so retry is saner
          try {
            const data = await getRecord(recordId)
            setLoadedValues(
              extractLoadedValues(
                data.record.id,
                data.record.values ?? [],
                (data.cnameChain ?? []) as ChainItem[]
              )
            )
            setValuesState(
              parseDetailToValuesState(
                data.record.values ?? [],
                (data.cnameChain ?? []) as ChainItem[]
              )
            )
          } catch {
            /* ignore */
          }
          setSaving(false)
          return
        }

        navigate(`/records/${recordId}`, {
          state: { flashSuccess: t('records.applySuccess') },
        })
      }
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { data?: { error?: string } } }).response?.data?.error
      setError(typeof msg === 'string' ? msg : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6 w-full">
      <Breadcrumbs
        items={[
          { label: t('nav.records'), to: '/records' },
          { label: isEdit ? t('records.editTitle') : t('records.createTitle') },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button
            variant="secondary"
            className="cursor-pointer bg-muted hover:bg-muted/80 font-medium"
            onClick={handleBack}
            disabled={saving}
          >
            <ArrowLeft className="h-4 w-4" />
            {t('common.back')}
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEdit ? t('records.editTitle') : t('records.createTitle')}
          </h1>
          {source && <Badge variant="secondary">{source}</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={saving} onClick={handleCancel}>
            {t('common.cancel')}
          </Button>
          <Button disabled={saving} onClick={() => void handleSubmit()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? t('records.apply') : t('common.create')}
          </Button>
        </div>
      </div>

      <div className="border-t" />

      {error && <p className="text-sm text-destructive">{error}</p>}
      {errorList.length > 0 && (
        <ul className="list-disc ps-5 text-sm text-destructive space-y-1">
          {errorList.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
      {successMsg && (
        <p className="text-sm text-green-600 dark:text-green-400">{successMsg}</p>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
        <div className="flex flex-1 min-w-0 items-center gap-3">
          <Label htmlFor="record-domain" className="shrink-0 w-16">
            {t('records.domain')}
          </Label>
          <Input
            id="record-domain"
            className="font-mono flex-1 min-w-0"
            value={domain}
            disabled={saving}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
          />
        </div>
        <div className="flex items-center gap-3 shrink-0 lg:ps-2">
          <Switch
            checked={enabled}
            disabled={saving}
            onCheckedChange={setEnabled}
            aria-label={t('records.enabled')}
          />
          <span className="text-sm text-muted-foreground">
            {enabled ? t('common.enabled') : t('common.disabled')}
          </span>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium mb-3">{t('records.valuesSection')}</h2>
        <RecordValueGroups
          state={valuesState}
          disabled={saving}
          isEdit={isEdit}
          servers={servers}
          onChange={setValuesState}
        />
      </div>
    </div>
  )
}
