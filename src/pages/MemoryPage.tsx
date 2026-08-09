import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Database,
  Layers,
  RefreshCw,
  Server,
  MemoryStick,
  MoreHorizontal,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  getMemoryStore,
  getPendingCache,
  type MemoryRecordItem,
  type MemoryPendingItem,
  type MemoryCustomGroup,
} from '@/api/memory'
import {
  flushCache,
  reloadMemory,
  type ReloadScope,
} from '@/api/system'
import type { PaginationMeta } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Loading } from '@/components/Loading'
import { NoResult } from '@/components/NoResult'
import { PaginationBar } from '@/components/PaginationBar'
import { RelativeTime } from '@/components/RelativeTime'
import { cn } from '@/lib/utils'

type TabId = 'pending' | 'exact' | 'regex' | 'defaultServers' | 'customServers'

function formatList(value: unknown): string {
  if (value == null) return '—'
  if (Array.isArray(value)) {
    if (value.length === 0) return '—'
    return value.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join(', ')
  }
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/** Shared row overflow menu (placeholders until row-level APIs exist). */
function RowActionsMenu() {
  const { t } = useTranslation()
  return (
    <DropdownMenu
      trigger={
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t('common.actions')}>
          <MoreHorizontal className="hidden h-4 w-4 md:block" />
          <MoreVertical className="h-4 w-4 md:hidden" />
        </Button>
      }
    >
      <DropdownMenuItem disabled>
        <Eye className="h-4 w-4" />
        {t('common.view')}
      </DropdownMenuItem>
      <DropdownMenuItem disabled>
        <Pencil className="h-4 w-4" />
        {t('common.edit')}
      </DropdownMenuItem>
      <DropdownMenuItem disabled destructive>
        <Trash2 className="h-4 w-4" />
        {t('common.delete')}
      </DropdownMenuItem>
    </DropdownMenu>
  )
}

export default function MemoryPage() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const canManage = hasRole('superadmin')

  const [tab, setTab] = useState<TabId>('pending')
  const [page, setPage] = useState(1)
  const [limit] = useState(20)

  const [storeLoading, setStoreLoading] = useState(true)
  const [pendingLoading, setPendingLoading] = useState(true)
  const [error, setError] = useState('')

  const [exact, setExact] = useState<MemoryRecordItem[]>([])
  const [regex, setRegex] = useState<MemoryRecordItem[]>([])
  const [defaultServers, setDefaultServers] = useState<Record<string, unknown>[]>([])
  const [customServers, setCustomServers] = useState<MemoryCustomGroup[]>([])
  const [pending, setPending] = useState<MemoryPendingItem[]>([])

  const [exactPag, setExactPag] = useState<PaginationMeta | null>(null)
  const [regexPag, setRegexPag] = useState<PaginationMeta | null>(null)
  const [defaultPag, setDefaultPag] = useState<PaginationMeta | null>(null)
  const [customPag, setCustomPag] = useState<PaginationMeta | null>(null)
  const [pendingPag, setPendingPag] = useState<PaginationMeta | null>(null)

  const [busy, setBusy] = useState(false)
  const [actionMsg, setActionMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  const loadStore = useCallback(async () => {
    setStoreLoading(true)
    setError('')
    try {
      const data = await getMemoryStore({ page, limit })
      setExact(data.exactRecords.items)
      setExactPag(data.exactRecords.pagination)
      setRegex(data.regexRecords.items)
      setRegexPag(data.regexRecords.pagination)
      setDefaultServers(data.defaultDnsServers.items as Record<string, unknown>[])
      setDefaultPag(data.defaultDnsServers.pagination)
      setCustomServers(data.customDnsServers.items as MemoryCustomGroup[])
      setCustomPag(data.customDnsServers.pagination)
    } catch {
      setError(t('common.error'))
    } finally {
      setStoreLoading(false)
    }
  }, [page, limit, t])

  const loadPending = useCallback(async () => {
    setPendingLoading(true)
    try {
      const data = await getPendingCache({ page, limit })
      setPending(data.items)
      setPendingPag(data.pagination)
    } catch {
      setPending([])
      setPendingPag(null)
    } finally {
      setPendingLoading(false)
    }
  }, [page, limit])

  const refreshAll = useCallback(async () => {
    await Promise.all([loadStore(), loadPending()])
  }, [loadStore, loadPending])

  useEffect(() => {
    void loadStore()
    void loadPending()
  }, [loadStore, loadPending])

  function switchTab(next: TabId) {
    setTab(next)
    setPage(1)
  }

  function goPrev() {
    setPage((p) => Math.max(1, p - 1))
  }
  function goNext() {
    setPage((p) => p + 1)
  }

  async function runFlush() {
    if (!canManage) return
    setBusy(true)
    setActionMsg(null)
    try {
      const res = await flushCache()
      setActionMsg({
        type: 'ok',
        text: t('memory.flushSuccess', { count: res.pendingBefore }),
      })
      await loadPending()
    } catch {
      setActionMsg({ type: 'error', text: t('common.error') })
    } finally {
      setBusy(false)
    }
  }

  async function runReload(scope: ReloadScope) {
    if (!canManage) return
    setBusy(true)
    setActionMsg(null)
    try {
      await reloadMemory(scope)
      setActionMsg({
        type: 'ok',
        text: t('memory.reloadSuccess', { scope: t(`memory.scope.${scope}`) }),
      })
      await refreshAll()
    } catch {
      setActionMsg({ type: 'error', text: t('common.error') })
    } finally {
      setBusy(false)
    }
  }

  const tabs: { id: TabId; label: string; total?: number }[] = [
    { id: 'pending', label: t('memory.pending'), total: pendingPag?.total },
    { id: 'exact', label: t('memory.exactRecords'), total: exactPag?.total },
    { id: 'regex', label: t('memory.regexRecords'), total: regexPag?.total },
    { id: 'defaultServers', label: t('memory.defaultServers'), total: defaultPag?.total },
    { id: 'customServers', label: t('memory.customServers'), total: customPag?.total },
  ]

  const activePag =
    tab === 'pending'
      ? pendingPag
      : tab === 'exact'
        ? exactPag
        : tab === 'regex'
          ? regexPag
          : tab === 'defaultServers'
            ? defaultPag
            : customPag

  const listLoading = tab === 'pending' ? pendingLoading : storeLoading

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('memory.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('memory.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={listLoading || busy}
            onClick={() => void refreshAll()}
          >
            <RefreshCw className={`h-4 w-4 ${listLoading ? 'animate-spin' : ''}`} />
            {t('memory.refresh')}
          </Button>

          {canManage && (
            <DropdownMenu
              trigger={
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={busy}
                  aria-label={t('common.actions')}
                >
                  <MoreHorizontal className="hidden h-4 w-4 md:block" />
                  <MoreVertical className="h-4 w-4 md:hidden" />
                </Button>
              }
            >
              <DropdownMenuItem onClick={() => void runFlush()}>
                <Layers className="h-4 w-4" />
                {t('memory.flush')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void runReload('all')}>
                <RefreshCw className="h-4 w-4" />
                {t('memory.reloadAll')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void runReload('records')}>
                <Database className="h-4 w-4" />
                {t('memory.reloadRecords')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void runReload('dns-servers')}>
                <Server className="h-4 w-4" />
                {t('memory.reloadServers')}
              </DropdownMenuItem>
            </DropdownMenu>
          )}
        </div>
      </div>

      {actionMsg && (
        <p
          className={
            actionMsg.type === 'ok'
              ? 'text-sm text-emerald-600 dark:text-emerald-400'
              : 'text-sm text-destructive'
          }
        >
          {actionMsg.text}
        </p>
      )}

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: t('memory.pending'), value: pendingPag?.total ?? '—', icon: Layers },
          { label: t('memory.exactRecords'), value: exactPag?.total ?? '—', icon: Database },
          { label: t('memory.regexRecords'), value: regexPag?.total ?? '—', icon: Database },
          { label: t('memory.defaultServers'), value: defaultPag?.total ?? '—', icon: Server },
          { label: t('memory.customServers'), value: customPag?.total ?? '—', icon: MemoryStick },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <s.icon className="h-3.5 w-3.5" />
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b pb-px">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => switchTab(item.id)}
            className={cn(
              'px-3 py-2 text-sm font-medium rounded-t-md transition-colors cursor-pointer',
              tab === item.id
                ? 'bg-muted text-foreground border border-b-0 border-border'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            {item.label}
            {item.total != null && (
              <span className="ms-1.5 text-xs tabular-nums text-muted-foreground">
                ({item.total})
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="pt-1">
        <PaginationBar
          pagination={activePag}
          loading={listLoading}
          onPrev={goPrev}
          onNext={goNext}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {tab === 'pending' && (
            <PendingTable items={pending} loading={pendingLoading} />
          )}
          {(tab === 'exact' || tab === 'regex') && (
            <RecordsTable
              items={tab === 'exact' ? exact : regex}
              loading={storeLoading}
            />
          )}
          {tab === 'defaultServers' && (
            <ServersTable items={defaultServers} loading={storeLoading} />
          )}
          {tab === 'customServers' && (
            <CustomGroupsTable items={customServers} loading={storeLoading} />
          )}
        </CardContent>
      </Card>

      <PaginationBar
        pagination={activePag}
        loading={listLoading}
        onPrev={goPrev}
        onNext={goNext}
      />
    </div>
  )
}

function PendingTable({
  items,
  loading,
}: {
  items: MemoryPendingItem[]
  loading: boolean
}) {
  const { t } = useTranslation()
  if (loading) return <Loading fullScreen={false} />
  if (!items.length) return <NoResult fullScreen={false} />

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-muted-foreground">
            <th className="px-4 py-3 text-start font-medium">{t('memory.domain')}</th>
            <th className="px-4 py-3 text-start font-medium">{t('memory.source')}</th>
            <th className="px-4 py-3 text-start font-medium">A</th>
            <th className="px-4 py-3 text-start font-medium">AAAA</th>
            <th className="px-4 py-3 text-start font-medium">CNAME</th>
            <th className="px-4 py-3 text-start font-medium">{t('memory.hits')}</th>
            <th className="px-4 py-3 text-start font-medium">{t('memory.lastHit')}</th>
            <th className="px-4 py-3 text-end font-medium">{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row, i) => (
            <tr key={`${row.domain}-${i}`} className="border-b last:border-0">
              <td className="px-4 py-3 font-mono text-xs break-all">
                {row.domain}
                {row.isRegex && (
                  <Badge variant="outline" className="ms-1 text-[10px]">
                    regex
                  </Badge>
                )}
              </td>
              <td className="px-4 py-3">
                <Badge variant="secondary">{row.source}</Badge>
              </td>
              <td className="px-4 py-3 font-mono text-[11px] max-w-[10rem] break-all">
                {formatList(row.A)}
              </td>
              <td className="px-4 py-3 font-mono text-[11px] max-w-[10rem] break-all">
                {formatList(row.AAAA)}
              </td>
              <td className="px-4 py-3 font-mono text-[11px] max-w-[10rem] break-all">
                {formatList(row.CNAME)}
              </td>
              <td className="px-4 py-3 tabular-nums">{row.hits}</td>
              <td className="px-4 py-3 text-muted-foreground">
                <RelativeTime value={row.lastHit} />
              </td>
              <td className="px-4 py-3 text-end">
                <RowActionsMenu />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RecordsTable({
  items,
  loading,
}: {
  items: MemoryRecordItem[]
  loading: boolean
}) {
  const { t } = useTranslation()
  if (loading) return <Loading fullScreen={false} />
  if (!items.length) return <NoResult fullScreen={false} />

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-muted-foreground">
            <th className="px-4 py-3 text-start font-medium">{t('memory.domain')}</th>
            <th className="px-4 py-3 text-start font-medium">{t('memory.source')}</th>
            <th className="px-4 py-3 text-start font-medium">{t('memory.enabled')}</th>
            <th className="px-4 py-3 text-start font-medium">{t('memory.hits')}</th>
            <th className="px-4 py-3 text-start font-medium">{t('memory.lastHit')}</th>
            <th className="px-4 py-3 text-start font-medium">{t('memory.updated')}</th>
            <th className="px-4 py-3 text-end font-medium">{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row, i) => (
            <tr key={`${row.domain}-${row.id ?? i}`} className="border-b last:border-0">
              <td className="px-4 py-3 font-mono text-xs break-all">
                {row.domain}
                {row.isRegex && (
                  <Badge variant="outline" className="ms-1 text-[10px]">
                    regex
                  </Badge>
                )}
              </td>
              <td className="px-4 py-3">
                <Badge variant="secondary">{row.source}</Badge>
              </td>
              <td className="px-4 py-3">
                <Badge variant={row.enabled ? 'success' : 'muted'}>
                  {row.enabled ? t('common.enabled') : t('common.disabled')}
                </Badge>
              </td>
              <td className="px-4 py-3 tabular-nums">{row.hits}</td>
              <td className="px-4 py-3 text-muted-foreground">
                <RelativeTime value={row.lastHit} />
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                <RelativeTime value={row.updatedAt} />
              </td>
              <td className="px-4 py-3 text-end">
                <RowActionsMenu />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ServersTable({
  items,
  loading,
}: {
  items: Record<string, unknown>[]
  loading: boolean
}) {
  const { t } = useTranslation()
  if (loading) return <Loading fullScreen={false} />
  if (!items.length) return <NoResult fullScreen={false} />

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-muted-foreground">
            <th className="px-4 py-3 text-start font-medium">{t('servers.ip')}</th>
            <th className="px-4 py-3 text-start font-medium">{t('servers.type')}</th>
            <th className="px-4 py-3 text-start font-medium">{t('servers.enabled')}</th>
            <th className="px-4 py-3 text-start font-medium">{t('servers.priority')}</th>
            <th className="px-4 py-3 text-start font-medium">{t('servers.latency')}</th>
            <th className="px-4 py-3 text-start font-medium">{t('servers.stats')}</th>
            <th className="px-4 py-3 text-end font-medium">{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row, i) => {
            const ip = String(row.ip ?? '—')
            const type = String(row.type ?? '—')
            const enabled = !!row.enabled
            const priority = Number(row.priority ?? 0)
            const latency = Number(row.average_latency ?? row.averageLatency ?? 0)
            const successes = Number(row.successes ?? 0)
            const failures = Number(row.failures ?? 0)
            const timeouts = Number(row.timeouts ?? 0)
            return (
              <tr key={`${ip}-${i}`} className="border-b last:border-0">
                <td className="px-4 py-3 font-mono text-xs">{ip}</td>
                <td className="px-4 py-3">
                  <Badge variant="secondary">{type}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={enabled ? 'success' : 'muted'}>
                    {enabled ? t('common.enabled') : t('common.disabled')}
                  </Badge>
                </td>
                <td className="px-4 py-3 tabular-nums">{priority}</td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">
                  {latency.toFixed(1)} ms
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                  ✓{successes} · ✗{failures} · ⏱{timeouts}
                </td>
                <td className="px-4 py-3 text-end">
                  <RowActionsMenu />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function CustomGroupsTable({
  items,
  loading,
}: {
  items: MemoryCustomGroup[]
  loading: boolean
}) {
  const { t } = useTranslation()
  if (loading) return <Loading fullScreen={false} />
  if (!items.length) return <NoResult fullScreen={false} />

  return (
    <div className="divide-y">
      {items.map((group, i) => {
        const domain = String(group.domain ?? '—')
        const servers = Array.isArray(group.servers) ? group.servers : []
        return (
          <div key={`${domain}-${i}`} className="flex items-start gap-3 px-4 py-3">
            <div className="flex-1 min-w-0 space-y-2">
              <p className="font-mono text-xs font-medium break-all">{domain}</p>
              {servers.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('common.noResults')}</p>
              ) : (
                <ul className="space-y-1">
                  {servers.map((s, j) => (
                    <li
                      key={`${s.ip ?? j}`}
                      className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
                    >
                      <span className="font-mono text-foreground">{s.ip ?? '—'}</span>
                      {s.type && (
                        <Badge variant="outline" className="text-[10px]">
                          {s.type}
                        </Badge>
                      )}
                      <span>
                        {t('servers.priority')}: {s.priority ?? 0}
                      </span>
                      <span>{Number(s.average_latency ?? 0).toFixed(1)} ms</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <RowActionsMenu />
          </div>
        )
      })}
    </div>
  )
}
