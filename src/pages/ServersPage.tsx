import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  MoreHorizontal,
  MoreVertical,
  Power,
  PowerOff,
  Pencil,
  Plus,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  listDnsServers,
  updateDnsServer,
  type DnsServerListItem,
} from '@/api/dns-servers'
import type { PaginationMeta } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Loading } from '@/components/Loading'
import { NoResult } from '@/components/NoResult'
import { PaginationBar } from '@/components/PaginationBar'
import { ListToolbar } from '@/components/ListToolbar'
import { SortableHeader, nextSortState } from '@/components/SortableHeader'
import { CopyButton } from '@/components/CopyButton'
import { usePersistedListState } from '@/hooks/usePersistedListState'
import { ServerFormModal } from '@/components/servers/ServerFormModal'

function typeBadgeVariant(type: string) {
  return type === 'DEFAULT' ? ('success' as const) : ('secondary' as const)
}

function RowActions({
  row,
  canWrite,
  actionLoading,
  onToggle,
  onEdit,
}: {
  row: DnsServerListItem
  canWrite: boolean
  actionLoading: boolean
  onToggle: () => void
  onEdit: () => void
}) {
  const { t } = useTranslation()
  return (
    <DropdownMenu
      align="end"
      trigger={
        <Button
          variant="ghost"
          size="icon"
          disabled={actionLoading}
          aria-label={t('common.actions')}
          className="cursor-pointer"
        >
          <MoreHorizontal className="hidden h-4 w-4 md:block" />
          <MoreVertical className="h-4 w-4 md:hidden" />
        </Button>
      }
    >
      {canWrite && (
        <DropdownMenuItem onClick={onToggle}>
          {row.enabled ? (
            <>
              <PowerOff className="h-4 w-4" />
              {t('servers.disable')}
            </>
          ) : (
            <>
              <Power className="h-4 w-4" />
              {t('servers.enable')}
            </>
          )}
        </DropdownMenuItem>
      )}
      {canWrite && (
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="h-4 w-4" />
          {t('common.edit')}
        </DropdownMenuItem>
      )}
    </DropdownMenu>
  )
}

export default function ServersPage() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const navigate = useNavigate()
  const canWrite = hasRole('superadmin')

  const [items, setItems] = useState<DnsServerListItem[]>([])
  const [pagination, setPagination] = useState<PaginationMeta | null>(null)
  const [limit] = useState(20)
  const { page, setPage, toolbarQuery, setToolbarQuery, sortState, setSortState } =
    usePersistedListState('servers', {
      page: 1,
      toolbarQuery: {
        search: '',
        searchField: 'ip',
        filters: [],
        filterLogic: 'AND',
      },
      sortState: { sortBy: null, sortDir: null },
    })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editServer, setEditServer] = useState<DnsServerListItem | null>(null)
  const [defaultCount, setDefaultCount] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listDnsServers({ page, limit, ...toolbarQuery, sortBy: sortState.sortBy ?? undefined, sortDir: sortState.sortDir ?? undefined })
      setItems(data.items)
      setPagination(data.pagination)
      try {
        const defaults = await listDnsServers({
          page: 1,
          limit: 100,
          filters: [{ id: 'f', field: 'type', value: 'DEFAULT' }],
        })
        setDefaultCount(
          defaults.items.filter((s) => s.type === 'DEFAULT' && s.enabled).length
        )
      } catch {
        setDefaultCount(
          data.items.filter((s) => s.type === 'DEFAULT' && s.enabled).length
        )
      }
    } catch {
      setError(t('common.error'))
      setItems([])
      setPagination(null)
    } finally {
      setLoading(false)
    }
  }, [page, limit, toolbarQuery, sortState, t])

  useEffect(() => {
    load()
  }, [load])

  async function handleToggleEnabled(row: DnsServerListItem) {
    if (!canWrite) return
    if (row.enabled && row.type === 'DEFAULT' && defaultCount <= 1) {
      setError(t('servers.lastDefaultGuard'))
      return
    }
    setActionLoading(row.id)
    try {
      await updateDnsServer(row.id, { enabled: !row.enabled })
      await load()
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { data?: { error?: string } } }).response?.data?.error
      setError(typeof msg === 'string' ? msg : t('common.error'))
    } finally {
      setActionLoading(null)
    }
  }

  function isLastDefault(row: DnsServerListItem) {
    return row.type === 'DEFAULT' && row.enabled && defaultCount <= 1
  }


  function goPrev() {
    setPage((p) => Math.max(1, p - 1))
  }
  function goNext() {
    setPage((p) => p + 1)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('servers.title')}</h1>
        <Button
          disabled={!canWrite}
          onClick={() => {
            setEditServer(null)
            setFormOpen(true)
          }}
        >
          <Plus className="h-4 w-4" />
          {t('common.create')}
        </Button>
      </div>

      <ListToolbar
        defaultSearch={toolbarQuery.search}
        defaultSearchField={toolbarQuery.searchField}
        defaultFilters={toolbarQuery.filters}
        defaultFilterLogic={toolbarQuery.filterLogic}
        searchFields={[
          { value: 'ip', label: t('servers.ip') },
          { value: 'type', label: t('servers.type') },
        ]}
        filterFields={[
          { value: 'ip', label: t('servers.ip'), type: 'string' },
          {
            value: 'type',
            label: t('servers.type'),
            type: 'enum',
            options: [
              { value: 'DEFAULT', label: 'DEFAULT' },
              { value: 'CUSTOM', label: 'CUSTOM' },
            ],
          },
          { value: 'enabled', label: t('servers.enabled'), type: 'boolean' },
          { value: 'priority', label: t('servers.priority'), type: 'number' },
          { value: 'id', label: 'ID', type: 'number' },
        ]}
        onSubmit={(payload) => {
          setPage(1)
          setToolbarQuery(payload)
        }}
      />

        <div className="pt-1">
          <PaginationBar
            pagination={pagination}
            loading={loading}
            onPrev={goPrev}
            onNext={goNext}
          />
        </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardContent className="p-0">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-muted-foreground">
                  <SortableHeader column="ip" label={t('servers.ip')} sortBy={sortState.sortBy} sortDir={sortState.sortDir} onSort={(c) => setSortState((s) => nextSortState(s, c))} />
                  <SortableHeader column="type" label={t('servers.type')} sortBy={sortState.sortBy} sortDir={sortState.sortDir} onSort={(c) => setSortState((s) => nextSortState(s, c))} />
                  <SortableHeader column="enabled" label={t('servers.enabled')} sortBy={sortState.sortBy} sortDir={sortState.sortDir} onSort={(c) => setSortState((s) => nextSortState(s, c))} />
                  <SortableHeader column="priority" label={t('servers.priority')} sortBy={sortState.sortBy} sortDir={sortState.sortDir} onSort={(c) => setSortState((s) => nextSortState(s, c))} />
                  <SortableHeader column="average_latency" label={t('servers.latency')} sortBy={sortState.sortBy} sortDir={sortState.sortDir} onSort={(c) => setSortState((s) => nextSortState(s, c))} />
                  <th className="px-4 py-3 text-start font-medium">{t('servers.stats')}</th>
                  <th className="px-4 py-3 text-end font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7}>
                      <Loading fullScreen={false} />
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <NoResult fullScreen={false} />
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr
                      key={row.id}
                      className="group border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                      onClick={() => navigate(`/servers/${row.id}`)}
                    >
                      <td className="px-4 py-3 font-medium font-mono">
                        <div className="flex items-center gap-1 min-w-0">
                          <Link
                            to={`/servers/${row.id}`}
                            className="hover:underline cursor-pointer truncate"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {row.ip}
                          </Link>
                          <CopyButton text={row.ip} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={typeBadgeVariant(row.type)}>{row.type}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={row.enabled ? 'success' : 'muted'}>
                          {row.enabled ? t('common.enabled') : t('common.disabled')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{row.priority}</td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {Number(row.average_latency).toFixed(1)} ms
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                        ✓{row.successes} · ✗{row.failures} · ⏱{row.timeouts}
                      </td>
                      <td
                        className="px-4 py-3 text-end"
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <RowActions
                          row={row}
                          canWrite={canWrite}
                          actionLoading={actionLoading === row.id}
                          onToggle={() => handleToggleEnabled(row)}
                          onEdit={() => {
                            setEditServer(row)
                            setFormOpen(true)
                          }}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card */}
          <div className="md:hidden divide-y">
            {loading ? (
              <Loading fullScreen={false} />
            ) : items.length === 0 ? (
              <NoResult fullScreen={false} />
            ) : (
              items.map((row) => (
                <div
                  key={row.id}
                  className="group flex items-start gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => navigate(`/servers/${row.id}`)}
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <p className="font-medium font-mono truncate">{row.ip}</p>
                      <CopyButton text={row.ip} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={typeBadgeVariant(row.type)}>{row.type}</Badge>
                      <Badge variant={row.enabled ? 'success' : 'muted'}>
                        {row.enabled ? t('common.enabled') : t('common.disabled')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('servers.priority')}: {row.priority} ·{' '}
                      {Number(row.average_latency).toFixed(1)} ms
                    </p>
                  </div>
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <RowActions
                      row={row}
                      canWrite={canWrite}
                      actionLoading={actionLoading === row.id}
                      onToggle={() => handleToggleEnabled(row)}
                      onEdit={() => {
                        setEditServer(row)
                        setFormOpen(true)
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

        <PaginationBar
          pagination={pagination}
          loading={loading}
          onPrev={goPrev}
          onNext={goNext}
        />

      <ServerFormModal
        open={formOpen}
        server={editServer}
        lockAsLastDefault={editServer != null && isLastDefault(editServer)}
        onClose={() => {
          setFormOpen(false)
          setEditServer(null)
        }}
        onSaved={() => void load()}
      />

    </div>
  )
}
