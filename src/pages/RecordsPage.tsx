import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  MoreHorizontal,
  MoreVertical,
  Power,
  PowerOff,
  ArrowUpCircle,
  ArrowDownCircle,
  Pencil,
  Trash2,
  Plus,
  RefreshCw,
  Globe2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  listRecords,
  setRecordsEnabled,
  promoteRecords,
  demoteRecords,
  deleteRecord,
  type RecordListItem,
} from '@/api/records'
import type { PaginationMeta } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuItem, DropdownMenuSub } from '@/components/ui/dropdown-menu'
import { RelativeTime } from '@/components/RelativeTime'
import { Loading } from '@/components/Loading'
import { NoResult } from '@/components/NoResult'
import { PaginationBar } from '@/components/PaginationBar'
import { ListToolbar } from '@/components/ListToolbar'
import { SortableHeader, nextSortState } from '@/components/SortableHeader'
import { CopyButton } from '@/components/CopyButton'
import { usePersistedListState } from '@/hooks/usePersistedListState'
import { useExternalResolvers } from '@/hooks/useExternalResolvers'
import { formatRemaining } from '@/api/external-resolvers'
import { ResolveExternalModal } from '@/components/records/ResolveExternalModal'
import { useRowSelection } from '@/hooks/useRowSelection'
import { BulkActionBar } from '@/components/BulkActionBar'
import { RowCheckbox } from '@/components/RowCheckbox'

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

function RowActions({
  row,
  canWrite,
  canPromote,
  canDemote,
  actionLoading,
  resolvers,
  resolversLoading,
  onToggle,
  onPromote,
  onDemote,
  onEdit,
  onDelete,
  onResolve,
}: {
  row: RecordListItem
  canWrite: boolean
  canPromote: boolean
  canDemote: boolean
  actionLoading: boolean
  resolvers: Array<{ id: number; name: string; remaining: number }>
  resolversLoading: boolean
  onToggle: () => void
  onPromote: () => void
  onDemote: () => void
  onEdit: () => void
  onDelete: () => void
  onResolve: (resolverId: number) => void
}) {
  const { t } = useTranslation()
  return (
    <DropdownMenu
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
              {t('records.disable')}
            </>
          ) : (
            <>
              <Power className="h-4 w-4" />
              {t('records.enable')}
            </>
          )}
        </DropdownMenuItem>
      )}
      {canPromote && (
        <DropdownMenuItem onClick={onPromote}>
          <ArrowUpCircle className="h-4 w-4" />
          {t('records.promote')}
        </DropdownMenuItem>
      )}
      {canDemote && (
        <DropdownMenuItem onClick={onDemote}>
          <ArrowDownCircle className="h-4 w-4" />
          {t('records.demote')}
        </DropdownMenuItem>
      )}
      {canWrite && (
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="h-4 w-4" />
          {t('common.edit')}
        </DropdownMenuItem>
      )}
      {canWrite && resolvers.length > 0 && (
        <DropdownMenuSub label={t('resolve.menu')} icon={<Globe2 className="h-4 w-4" />}>
          {resolvers.map((r) => {
            const noQuota = Number.isFinite(r.remaining) && r.remaining < 1
            return (
              <DropdownMenuItem
                key={r.id}
                onClick={() => onResolve(r.id)}
                disabled={resolversLoading || noQuota}
              >
                <Globe2 className="h-4 w-4" />
                {r.name}
                <span className="ms-auto text-[10px] tabular-nums text-muted-foreground">
                  {formatRemaining(r.remaining)}
                </span>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuSub>
      )}
      {canWrite && (
        <DropdownMenuItem onClick={onDelete} destructive>
          <Trash2 className="h-4 w-4" />
          {t('common.delete')}
        </DropdownMenuItem>
      )}
    </DropdownMenu>
  )
}

export default function RecordsPage() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const navigate = useNavigate()
  const canWrite = hasRole('superadmin', 'admin')
  const externalResolvers = useExternalResolvers(canWrite)
  const [resolveTarget, setResolveTarget] = useState<{
    record: RecordListItem
    resolverId: number
  } | null>(null)

  const [items, setItems] = useState<RecordListItem[]>([])
  const [pagination, setPagination] = useState<PaginationMeta | null>(null)
  const [limit] = useState(20)
  const { page, setPage, toolbarQuery, setToolbarQuery, sortState, setSortState } =
    usePersistedListState('records', {
      page: 1,
      toolbarQuery: {
        search: '',
        searchField: 'domain',
        filters: [],
        filterLogic: 'AND',
      },
      sortState: { sortBy: null, sortDir: null },
    })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const selection = useRowSelection()

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listRecords({ page, limit, ...toolbarQuery, sortBy: sortState.sortBy ?? undefined, sortDir: sortState.sortDir ?? undefined })
      setItems(data.items)
      setPagination(data.pagination)
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

  async function handleToggleEnabled(row: RecordListItem) {
    if (!canWrite) return
    setActionLoading(row.id)
    try {
      await setRecordsEnabled([row.id], !row.enabled)
      await load()
    } catch {
      setError(t('common.error'))
    } finally {
      setActionLoading(null)
    }
  }

  async function handlePromote(row: RecordListItem) {
    if (!canWrite) return
    setActionLoading(row.id)
    try {
      await promoteRecords([row.id])
      await load()
    } catch {
      setError(t('common.error'))
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDemote(row: RecordListItem) {
    if (!canWrite) return
    setActionLoading(row.id)
    try {
      await demoteRecords([row.id])
      await load()
    } catch {
      setError(t('common.error'))
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDelete(row: RecordListItem) {
    if (!canWrite) return
    if (!window.confirm(t('records.deleteRecordConfirm', { domain: row.domain }))) return
    setActionLoading(row.id)
    try {
      await deleteRecord(row.id)
      await load()
    } catch {
      setError(t('common.error'))
    } finally {
      setActionLoading(null)
    }
  }

  async function handleBulkEnable() {
    if (!canWrite || selection.count === 0) return
    setBulkBusy(true)
    setError('')
    try {
      await setRecordsEnabled(selection.selectedIds, true)
      selection.clear()
      await load()
    } catch {
      setError(t('common.error'))
    } finally {
      setBulkBusy(false)
    }
  }

  async function handleBulkDisable() {
    if (!canWrite || selection.count === 0) return
    setBulkBusy(true)
    setError('')
    try {
      await setRecordsEnabled(selection.selectedIds, false)
      selection.clear()
      await load()
    } catch {
      setError(t('common.error'))
    } finally {
      setBulkBusy(false)
    }
  }

  async function handleBulkDelete() {
    if (!canWrite || selection.count === 0) return
    if (!window.confirm(t('bulk.deleteConfirm', { count: selection.count }))) return
    setBulkBusy(true)
    setError('')
    try {
      for (const id of selection.selectedIds) {
        await deleteRecord(id)
      }
      selection.clear()
      await load()
    } catch {
      setError(t('common.error'))
    } finally {
      setBulkBusy(false)
    }
  }


  const canPromoteRow = (row: RecordListItem) =>
    canWrite && (row.source === 'CACHE' || row.source === 'FILTERED')

  const canDemoteRow = (row: RecordListItem) =>
    canWrite && row.source === 'LOCAL'

  function goPrev() {
    setPage((p) => Math.max(1, p - 1))
  }
  function goNext() {
    setPage((p) => p + 1)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('records.title')}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="cursor-pointer"
            disabled={loading}
            onClick={() => void load()}
            aria-label={t('common.refresh')}
            title={t('common.refresh')}
          >
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          </Button>
          <Button
            disabled={!canWrite}
            onClick={() => canWrite && navigate('/records/new')}
          >
            <Plus className="h-4 w-4" />
            {t('common.create')}
          </Button>
        </div>
      </div>

      <ListToolbar
        defaultSearch={toolbarQuery.search}
        defaultSearchField={toolbarQuery.searchField}
        defaultFilters={toolbarQuery.filters}
        defaultFilterLogic={toolbarQuery.filterLogic}
        searchFields={[
          { value: 'domain', label: t('records.domain') },
          { value: 'source', label: t('records.source') },
        ]}
        filterFields={[
          { value: 'domain', label: t('records.domain'), type: 'string' },
          {
            value: 'source',
            label: t('records.source'),
            type: 'enum',
            options: [
              { value: 'LOCAL', label: 'LOCAL' },
              { value: 'CACHE', label: 'CACHE' },
              { value: 'FILTERED', label: 'FILTERED' },
            ],
          },
          { value: 'enabled', label: t('records.enabled'), type: 'boolean' },
          { value: 'hits', label: t('records.hits'), type: 'number' },
          { value: 'id', label: 'ID', type: 'number' },
        ]}
        onSubmit={(payload) => {
          setPage(1)
          setToolbarQuery(payload)
        }}
      />

      {/* Top pagination — separated from toolbar */}
        <div className="pt-1">
          <PaginationBar
            pagination={pagination}
            loading={loading}
            onPrev={goPrev}
            onNext={goNext}
          />
        </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {canWrite && (
        <BulkActionBar
          selectedRows={selection.selectedRows}
          busy={bulkBusy}
          onEnable={() => void handleBulkEnable()}
          onDisable={() => void handleBulkDisable()}
          onDelete={() => void handleBulkDelete()}
          onClear={selection.clear}
        />
      )}

      <Card>
        <CardContent className="p-0">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-muted-foreground">
                  {canWrite && (
                    <th className="w-10 px-3 py-3">
                      <RowCheckbox
                        aria-label={t('bulk.selectAll')}
                        checked={selection.pageCheckState(items.map((r) => r.id)) === 'all'}
                        indeterminate={selection.pageCheckState(items.map((r) => r.id)) === 'some'}
                        disabled={loading || items.length === 0 || bulkBusy}
                        onChange={() =>
                          selection.togglePage(items.map((r) => ({ id: r.id, label: r.domain })))
                        }
                      />
                    </th>
                  )}
                  <SortableHeader column="domain" label={t('records.domain')} sortBy={sortState.sortBy} sortDir={sortState.sortDir} onSort={(c) => setSortState((s) => nextSortState(s, c))} />
                  <SortableHeader column="source" label={t('records.source')} sortBy={sortState.sortBy} sortDir={sortState.sortDir} onSort={(c) => setSortState((s) => nextSortState(s, c))} />
                  <SortableHeader column="enabled" label={t('records.enabled')} sortBy={sortState.sortBy} sortDir={sortState.sortDir} onSort={(c) => setSortState((s) => nextSortState(s, c))} />
                  <SortableHeader column="hits" label={t('records.hits')} sortBy={sortState.sortBy} sortDir={sortState.sortDir} onSort={(c) => setSortState((s) => nextSortState(s, c))} />
                  <SortableHeader column="last_hit" label={t('records.lastHit')} sortBy={sortState.sortBy} sortDir={sortState.sortDir} onSort={(c) => setSortState((s) => nextSortState(s, c))} />
                  <SortableHeader column="updated_at" label={t('records.updated')} sortBy={sortState.sortBy} sortDir={sortState.sortDir} onSort={(c) => setSortState((s) => nextSortState(s, c))} />
                  <th className="px-4 py-3 text-end font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={canWrite ? 8 : 7}>
                      <Loading fullScreen={false} />
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={canWrite ? 8 : 7}>
                      <NoResult fullScreen={false} />
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr
                      key={row.id}
                      className="group border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                      onClick={() => navigate(`/records/${row.id}`)}
                    >
                      {canWrite && (
                        <td
                          className="w-10 px-3 py-3"
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <RowCheckbox
                            aria-label={t('bulk.selectRow')}
                            checked={selection.isSelected(row.id)}
                            disabled={bulkBusy}
                            onChange={() => selection.toggle(row.id, row.domain)}
                          />
                        </td>
                      )}
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-1 min-w-0">
                          <Link
                            to={`/records/${row.id}`}
                            className="hover:underline cursor-pointer truncate"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {row.domain}
                          </Link>
                          <CopyButton text={row.domain} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={sourceBadgeVariant(row.source)}>{row.source}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={row.enabled ? 'success' : 'muted'}>
                          {row.enabled ? t('common.enabled') : t('common.disabled')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{row.hits}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <RelativeTime value={row.last_hit} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <RelativeTime value={row.updated_at} />
                      </td>
                      <td
                        className="px-4 py-3 text-end"
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <RowActions
                          row={row}
                          canWrite={canWrite}
                          canPromote={canPromoteRow(row)}
                          canDemote={canDemoteRow(row)}
                          actionLoading={actionLoading === row.id}
                          onToggle={() => handleToggleEnabled(row)}
                          onPromote={() => handlePromote(row)}
                          onDemote={() => handleDemote(row)}
                          onEdit={() => navigate(`/records/${row.id}/edit`)}
                          onDelete={() => handleDelete(row)}
                          resolvers={externalResolvers.items}
                          resolversLoading={externalResolvers.loading}
                          onResolve={(resolverId) => setResolveTarget({ record: row, resolverId })}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
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
                  onClick={() => navigate(`/records/${row.id}`)}
                >
                  {canWrite && (
                    <div
                      className="pt-1"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <RowCheckbox
                        aria-label={t('bulk.selectRow')}
                        checked={selection.isSelected(row.id)}
                        disabled={bulkBusy}
                        onChange={() => selection.toggle(row.id, row.domain)}
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <p className="font-medium truncate">{row.domain}</p>
                      <CopyButton text={row.domain} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={sourceBadgeVariant(row.source)}>{row.source}</Badge>
                      <Badge variant={row.enabled ? 'success' : 'muted'}>
                        {row.enabled ? t('common.enabled') : t('common.disabled')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('records.hits')}: {row.hits} · <RelativeTime value={row.updated_at} />
                    </p>
                  </div>
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <RowActions
                      row={row}
                      canWrite={canWrite}
                      canPromote={canPromoteRow(row)}
                      canDemote={canDemoteRow(row)}
                      actionLoading={actionLoading === row.id}
                      onToggle={() => handleToggleEnabled(row)}
                      onPromote={() => handlePromote(row)}
                      onDemote={() => handleDemote(row)}
                      onEdit={() => navigate(`/records/${row.id}/edit`)}
                      onDelete={() => handleDelete(row)}
                      resolvers={externalResolvers.items}
                      resolversLoading={externalResolvers.loading}
                      onResolve={(resolverId) => setResolveTarget({ record: row, resolverId })}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bottom pagination */}
      {pagination && pagination.totalPages > 0 && (
        <PaginationBar
          pagination={pagination}
          loading={loading}
          onPrev={goPrev}
          onNext={goNext}
        />
      )}
      <ResolveExternalModal
        open={resolveTarget != null}
        domain={resolveTarget?.record.domain ?? ''}
        recordId={resolveTarget?.record.id ?? 0}
        resolverId={resolveTarget?.resolverId ?? 0}
        resolverName={
          externalResolvers.items.find((r) => r.id === resolveTarget?.resolverId)?.name ?? ''
        }
        remaining={
          externalResolvers.items.find((r) => r.id === resolveTarget?.resolverId)?.remaining ?? 0
        }
        onClose={() => {
          const id = resolveTarget?.resolverId
          setResolveTarget(null)
          if (id) void externalResolvers.refreshOne(id)
        }}
        onApplied={() => {
          void load()
          if (resolveTarget) void externalResolvers.refreshOne(resolveTarget.resolverId)
        }}
        onQuotaConsumed={(n) => {
          if (resolveTarget) externalResolvers.consume(resolveTarget.resolverId, n ?? 1)
        }}
      />

    </div>
  )
}
