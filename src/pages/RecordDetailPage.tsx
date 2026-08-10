import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  Power,
  PowerOff,
  ArrowUpCircle,
  ArrowDownCircle,
  Pencil,
  Trash2,
  MoreHorizontal,
  MoreVertical,
  ChevronRight,
  Plus,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  getRecord,
  setRecordsEnabled,
  promoteRecords,
  demoteRecords,
  deleteRecord,
  type RecordDetailResponse,
  type RecordValueItem,
} from '@/api/records'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { RelativeTime } from '@/components/RelativeTime'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { cn } from '@/lib/utils'
import { Loading } from '@/components/Loading'
import { CreateMissingCnameModal } from '@/components/records/CreateMissingCnameModal'

function sourceBadgeVariant(source: string) {
  switch (source) {
    case 'LOCAL':
      return 'success' as const
    case 'CACHE':
      return 'secondary' as const
    case 'FILTERED':
      return 'warning' as const
    default:
      return 'muted' as const
  }
}

function statusBadgeVariant(status: string) {
  const s = status.toLowerCase()
  if (s === 'success' || s === 'ok' || s === 'active') return 'success' as const
  if (s === 'error' || s === 'fail' || s === 'failed' || s === 'nxdomain') return 'destructive' as const
  if (s === 'timeout' || s === 'pending' || s === 'stale') return 'warning' as const
  return 'muted' as const
}

/** Render DNS answer values as chips instead of raw JSON arrays */
function ValueDisplay({ value }: { value: unknown }) {
  if (value == null) {
    return <span className="text-muted-foreground">—</span>
  }

  const items: string[] = []
  if (typeof value === 'string') {
    items.push(value)
  } else if (Array.isArray(value)) {
    for (const v of value) {
      if (typeof v === 'string') items.push(v)
      else if (v && typeof v === 'object' && 'domain' in (v as object)) {
        items.push(String((v as { domain?: string }).domain ?? JSON.stringify(v)))
      } else if (v && typeof v === 'object' && 'ip' in (v as object)) {
        items.push(String((v as { ip?: string }).ip ?? JSON.stringify(v)))
      } else {
        items.push(typeof v === 'object' ? JSON.stringify(v) : String(v))
      }
    }
  } else if (typeof value === 'object') {
    items.push(JSON.stringify(value))
  } else {
    items.push(String(value))
  }

  if (items.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }

  if (items.length === 1) {
    return <span className="font-mono text-xs break-all">{items[0]}</span>
  }

  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item, i) => (
        <span
          key={`${item}-${i}`}
          className="inline-flex max-w-full items-center rounded-md border bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] break-all"
        >
          {item}
        </span>
      ))}
    </div>
  )
}

export default function RecordDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const flashSuccess =
    location.state &&
    typeof location.state === 'object' &&
    location.state !== null &&
    'flashSuccess' in location.state
      ? String((location.state as { flashSuccess?: string }).flashSuccess ?? '')
      : ''
  const { hasRole } = useAuth()
  const canWrite = hasRole('superadmin', 'admin')

  const [data, setData] = useState<RecordDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [missingCnameDomain, setMissingCnameDomain] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const recordId = Number(id)

  const load = useCallback(async () => {
    if (!Number.isFinite(recordId) || recordId < 1) {
      setError(t('common.error'))
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await getRecord(recordId)
      setData(res)
    } catch {
      setError(t('common.error'))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [recordId, t])

  useEffect(() => {
    load()
  }, [load])

  const record = data?.record

  async function handleToggleEnabled() {
    if (!record || !canWrite) return
    setActionLoading(true)
    try {
      await setRecordsEnabled([record.id], !record.enabled)
      await load()
    } catch {
      setError(t('common.error'))
    } finally {
      setActionLoading(false)
    }
  }

  async function handlePromote() {
    if (!record || !canWrite) return
    setActionLoading(true)
    try {
      await promoteRecords([record.id])
      await load()
    } catch {
      setError(t('common.error'))
    } finally {
      setActionLoading(false)
    }
  }

  const canPromote =
    canWrite && record && (record.source === 'CACHE' || record.source === 'FILTERED')

  const canDemote = canWrite && record && record.source === 'LOCAL'

  async function handleDemote() {
    if (!record || !canWrite) return
    setActionLoading(true)
    try {
      await demoteRecords([record.id])
      await load()
    } catch {
      setError(t('common.error'))
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDelete() {
    if (!record || !canWrite) return
    if (!window.confirm(t('records.deleteRecordConfirm', { domain: record.domain }))) return
    setActionLoading(true)
    try {
      await deleteRecord(record.id)
      navigate('/records', { replace: true })
    } catch {
      setError(t('common.error'))
      setActionLoading(false)
    }
  }

  function handleBack() {
    // Prefer browser history so CNAME → detail → Back returns to previous detail
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/records')
    }
  }

  if (loading) {
    return <Loading />
  }

  if (error || !record) {
    return (
      <div className="space-y-4">
        <Button
          variant="secondary"
          size="default"
          className="cursor-pointer bg-muted hover:bg-muted/80"
          onClick={handleBack}
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </Button>
        <p className="text-destructive">{error || t('common.error')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: t('nav.records'), to: '/records' },
          { label: record.domain },
        ]}
      />

      {flashSuccess && (
        <div
          role="status"
          className="rounded-lg border border-green-600/40 bg-green-600/10 px-3 py-2 text-sm text-green-800 dark:text-green-200"
        >
          {flashSuccess}
        </div>
      )}

      {/* Top actions row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button
            variant="secondary"
            size="default"
            className="cursor-pointer bg-muted hover:bg-muted/80 font-medium"
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4" />
            {t('common.back')}
          </Button>
          <h1 className="text-2xl font-bold tracking-tight break-all">{record.domain}</h1>
          <div className="flex flex-wrap gap-2">
            <Badge variant={sourceBadgeVariant(record.source)}>{record.source}</Badge>
            <Badge variant={record.enabled ? 'success' : 'muted'}>
              {record.enabled ? t('common.enabled') : t('common.disabled')}
            </Badge>
            {record.is_regex && <Badge variant="outline">regex</Badge>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canWrite && (
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer"
              disabled={actionLoading}
              onClick={handleToggleEnabled}
            >
              {record.enabled ? (
                <>
                  <PowerOff className="h-4 w-4" />
                  {t('records.disable')}
                </>
              ) : (
                <>
                  <Power className="h-4 w-4" />
                  {t('records.enable')}
                </>
              )}
            </Button>
          )}
          {canPromote && (
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer"
              disabled={actionLoading}
              onClick={handlePromote}
            >
              <ArrowUpCircle className="h-4 w-4" />
              {t('records.promote')}
            </Button>
          )}
          <DropdownMenu
            trigger={
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 cursor-pointer"
                aria-label={t('common.actions')}
              >
                <MoreHorizontal className="hidden h-4 w-4 md:block" />
                <MoreVertical className="h-4 w-4 md:hidden" />
              </Button>
            }
          >
            {canWrite && (
              <DropdownMenuItem onClick={() => navigate(`/records/${record.id}/edit`)}>
                <Pencil className="h-4 w-4" />
                {t('common.edit')}
              </DropdownMenuItem>
            )}
            {canDemote && (
              <DropdownMenuItem onClick={() => void handleDemote()}>
                <ArrowDownCircle className="h-4 w-4" />
                {t('records.demote')}
              </DropdownMenuItem>
            )}
            {canWrite && (
              <DropdownMenuItem onClick={() => void handleDelete()} destructive>
                <Trash2 className="h-4 w-4" />
                {t('common.delete')}
              </DropdownMenuItem>
            )}
          </DropdownMenu>
        </div>
      </div>

      {/* Visual separation between actions and content */}
      <div className="border-t" />

      {/* Meta */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t('records.hits')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{record.hits}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t('records.lastHit')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              <RelativeTime value={record.last_hit} />
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t('records.created')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              <RelativeTime value={record.created_at} />
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t('records.updated')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              <RelativeTime value={record.updated_at} />
            </p>
          </CardContent>
        </Card>
      </div>

      {/* DNS answers (was "Values") */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('records.answers')}</CardTitle>
        </CardHeader>
        <CardContent>
          {!record.values?.length ? (
            <p className="text-sm text-muted-foreground">{t('common.noResults')}</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-muted-foreground">
                    <th className="px-3 py-2 text-start font-medium">{t('records.type')}</th>
                    <th className="px-3 py-2 text-start font-medium">{t('records.value')}</th>
                    <th className="px-3 py-2 text-start font-medium">{t('records.ttl')}</th>
                    <th className="px-3 py-2 text-start font-medium">{t('records.status')}</th>
                    <th className="px-3 py-2 text-center font-medium">{t('records.selected')}</th>
                    <th className="px-3 py-2 text-start font-medium">{t('records.server')}</th>
                    <th className="px-3 py-2 text-end font-medium">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {record.values.map((v: RecordValueItem) => (
                    <tr key={v.id} className="border-b last:border-0">
                      <td className="px-3 py-2 font-mono text-xs font-medium">{v.type}</td>
                      <td className="px-3 py-2 max-w-xs">
                        <ValueDisplay value={v.value} />
                      </td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">
                        {v.ttl ?? '—'}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={statusBadgeVariant(v.status)} className="text-[10px]">
                          {v.status}
                          {v.is_stale ? ' · stale' : ''}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={!!v.selected}
                          readOnly
                          disabled
                          className="h-4 w-4 rounded border-input accent-primary cursor-default"
                          aria-label={t('records.selected')}
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        {v.dnsServer?.ip ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-end">
                        <DropdownMenu
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="cursor-pointer h-8 w-8"
                              aria-label={t('common.actions')}
                            >
                              <MoreHorizontal className="hidden h-4 w-4 md:block" />
                              <MoreVertical className="h-4 w-4 md:hidden" />
                            </Button>
                          }
                        >
                          <DropdownMenuItem disabled>
                            <Pencil className="h-4 w-4" />
                            {t('common.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled destructive>
                            <Trash2 className="h-4 w-4" />
                            {t('common.delete')}
                          </DropdownMenuItem>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CNAME chain — redesigned as a clear path */}
      {data.cnameChain && data.cnameChain.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('records.cnameChain')}</CardTitle>
            <p className="text-sm text-muted-foreground">{t('records.cnameChainHint')}</p>
          </CardHeader>
          <CardContent>
            <ol className="space-y-0">
              {/* Root domain */}
              <li className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    1
                  </span>
                  <span className="my-1 w-px flex-1 min-h-[1.25rem] bg-border" />
                </div>
                <div className="pb-4 min-w-0">
                  <p className="font-medium break-all">{record.domain}</p>
                  <p className="text-xs text-muted-foreground">{t('records.cnameRoot')}</p>
                </div>
              </li>

              {data.cnameChain.map((item, idx) => {
                const step = idx + 2
                const isMissing = 'missing' in item && item.missing
                const hasId = 'id' in item && typeof item.id === 'number'
                const domain = item.domain
                const source = !isMissing && 'source' in item ? item.source : null
                const values = !isMissing && 'values' in item ? item.values : []

                return (
                  <li key={hasId ? item.id : `missing-${idx}`} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                          isMissing
                            ? 'bg-destructive/15 text-destructive'
                            : 'bg-muted text-foreground'
                        )}
                      >
                        {step}
                      </span>
                      {idx < data.cnameChain.length - 1 && (
                        <span className="my-1 w-px flex-1 min-h-[1.25rem] bg-border" />
                      )}
                    </div>
                    <div className={cn('pb-4 min-w-0 flex-1', idx === data.cnameChain.length - 1 && 'pb-0')}>
                      <div className="flex flex-wrap items-center gap-2">
                        {hasId && !isMissing ? (
                          <Link
                            to={`/records/${item.id}`}
                            className="font-medium break-all hover:underline cursor-pointer"
                          >
                            {domain}
                          </Link>
                        ) : (
                          <span className="font-medium break-all">{domain}</span>
                        )}
                        {isMissing && (
                          <Badge variant="destructive" className="text-[10px]">
                            {t('records.missing')}
                          </Badge>
                        )}
                        {isMissing && canWrite && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs cursor-pointer"
                            onClick={() => setMissingCnameDomain(domain)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            {t('records.addMissingCname')}
                          </Button>
                        )}
                        {source && (
                          <Badge variant={sourceBadgeVariant(String(source))} className="text-[10px]">
                            {source}
                          </Badge>
                        )}
                        {hasId && !isMissing && (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>
                      {!isMissing && values && values.length > 0 && (
                        <ul className="mt-1.5 space-y-1">
                          {values.map((v) => (
                            <li key={v.id} className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-mono font-medium text-muted-foreground">
                                {v.type}
                              </span>
                              <ValueDisplay value={v.value} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          </CardContent>
        </Card>
      )}
      <CreateMissingCnameModal
        open={missingCnameDomain != null}
        domain={missingCnameDomain ?? ''}
        onClose={() => setMissingCnameDomain(null)}
        onCreated={() => void load()}
      />

    </div>
  )
}
