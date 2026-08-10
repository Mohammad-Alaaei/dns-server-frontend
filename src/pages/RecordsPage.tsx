import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  MoreHorizontal,
  MoreVertical,
  Search,
  Eye,
  Power,
  PowerOff,
  ArrowUpCircle,
  Pencil,
  Trash2,
  Plus,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  listRecords,
  setRecordsEnabled,
  promoteRecords,
  type RecordListItem,
} from '@/api/records'
import type { PaginationMeta } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { RelativeTime } from '@/components/RelativeTime'
import { Loading } from '@/components/Loading'
import { NoResult } from '@/components/NoResult'
import { PaginationBar } from '@/components/PaginationBar'
import { ListToolbar } from '@/components/ListToolbar'
import type { ListToolbarSubmit } from '@/lib/listQuery'
import { SortableHeader, nextSortState, type SortState } from '@/components/SortableHeader'

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
  actionLoading,
  onView,
  onToggle,
  onPromote,
}: {
  row: RecordListItem
  canWrite: boolean
  canPromote: boolean
  actionLoading: boolean
  onView: () => void
  onToggle: () => void
  onPromote: () => void
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
          {/* Horizontal on md+, vertical on small screens */}
          <MoreHorizontal className="hidden h-4 w-4 md:block" />
          <MoreVertical className="h-4 w-4 md:hidden" />
        </Button>
      }
    >
      <DropdownMenuItem onClick={onView}>
        <Eye className="h-4 w-4" />
        {t('common.view')}
      </DropdownMenuItem>
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

export default function RecordsPage() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const navigate = useNavigate()
  const canWrite = hasRole('superadmin', 'admin')

  const [items, setItems] = useState<RecordListItem[]>([])
  const [pagination, setPagination] = useState<PaginationMeta | null>(null)
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [toolbarQuery, setToolbarQuery] = useState<ListToolbarSubmit>({
    search: '',
    searchField: 'domain',
    filters: [],
    filterLogic: 'AND',
  })
  const [sortState, setSortState] = useState<SortState>({ sortBy: null, sortDir: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<number | null>(null)

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

  const canPromoteRow = (row: RecordListItem) =>
    canWrite && (row.source === 'CACHE' || row.source === 'FILTERED')

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
        <Button disabled title={t('common.comingSoon')} className="cursor-not-allowed">
          <Plus className="h-4 w-4" />
          {t('common.create')}
        </Button>
      </div>

      <ListToolbar
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
        defaultSearchField="domain"
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

      <Card>
        <CardContent className="p-0">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-muted-foreground">
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
                      className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                      onClick={() => navigate(`/records/${row.id}`)}
                    >
                      <td className="px-4 py-3 font-medium">
                        <Link
                          to={`/records/${row.id}`}
                          className="hover:underline cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.domain}
                        </Link>
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
                          actionLoading={actionLoading === row.id}
                          onView={() => navigate(`/records/${row.id}`)}
                          onToggle={() => handleToggleEnabled(row)}
                          onPromote={() => handlePromote(row)}
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
                  className="flex items-start gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => navigate(`/records/${row.id}`)}
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-medium truncate">{row.domain}</p>
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
                      actionLoading={actionLoading === row.id}
                      onView={() => navigate(`/records/${row.id}`)}
                      onToggle={() => handleToggleEnabled(row)}
                      onPromote={() => handlePromote(row)}
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
    </div>
  )
}
