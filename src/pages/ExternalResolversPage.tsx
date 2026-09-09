import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  MoreHorizontal,
  MoreVertical,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Trash2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  deleteExternalResolver,
  listExternalResolvers,
  updateExternalResolver,
  type ExternalResolver,
} from '@/api/external-resolvers'
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
import { usePersistedListState } from '@/hooks/usePersistedListState'
import { ResolverFormModal } from '@/components/external-resolvers/ResolverFormModal'

function RowActions({
  row,
  canWrite,
  actionLoading,
  onToggle,
  onEdit,
  onDelete,
}: {
  row: ExternalResolver
  canWrite: boolean
  actionLoading: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
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
              {t('common.disabled')}
            </>
          ) : (
            <>
              <Power className="h-4 w-4" />
              {t('common.enabled')}
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
      {canWrite && (
        <DropdownMenuItem onClick={onDelete} destructive>
          <Trash2 className="h-4 w-4" />
          {t('common.delete')}
        </DropdownMenuItem>
      )}
    </DropdownMenu>
  )
}

export default function ExternalResolversPage() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const navigate = useNavigate()
  const canWrite = hasRole('superadmin', 'admin')

  const [items, setItems] = useState<ExternalResolver[]>([])
  const [pagination, setPagination] = useState<PaginationMeta | null>(null)
  const [limit] = useState(20)
  const { page, setPage, toolbarQuery, setToolbarQuery, sortState, setSortState } =
    usePersistedListState('external-resolvers', {
      page: 1,
      toolbarQuery: {
        search: '',
        searchField: 'name',
        filters: [],
        filterLogic: 'AND',
      },
      sortState: { sortBy: null, sortDir: null },
    })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editRow, setEditRow] = useState<ExternalResolver | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listExternalResolvers({
        page,
        limit,
        ...toolbarQuery,
        sortBy: sortState.sortBy ?? undefined,
        sortDir: sortState.sortDir ?? undefined,
      })
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
    void load()
  }, [load])

  async function handleToggle(row: ExternalResolver) {
    if (!canWrite) return
    setActionLoading(row.id)
    try {
      await updateExternalResolver(row.id, { enabled: !row.enabled })
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

  async function handleDelete(row: ExternalResolver) {
    if (!canWrite) return
    if (!window.confirm(t('externalResolvers.deleteConfirm', { name: row.name }))) return
    setActionLoading(row.id)
    try {
      await deleteExternalResolver(row.id)
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

  function goPrev() {
    setPage((p) => Math.max(1, p - 1))
  }
  function goNext() {
    setPage((p) => p + 1)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('externalResolvers.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('externalResolvers.subtitle')}</p>
        </div>
        <Button
          disabled={!canWrite}
          onClick={() => {
            setEditRow(null)
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
          { value: 'name', label: t('externalResolvers.name') },
          { value: 'provider', label: t('externalResolvers.provider') },
          { value: 'mode', label: t('externalResolvers.mode') },
        ]}
        filterFields={[
          { value: 'name', label: t('externalResolvers.name'), type: 'string' },
          { value: 'provider', label: t('externalResolvers.provider'), type: 'string' },
          {
            value: 'mode',
            label: t('externalResolvers.mode'),
            type: 'enum',
            options: [
              { value: 'manual_only', label: t('externalResolvers.modes.manual_only') },
              { value: 'filtered_only', label: t('externalResolvers.modes.filtered_only') },
              { value: 'timeout', label: t('externalResolvers.modes.timeout') },
              { value: 'all', label: t('externalResolvers.modes.all') },
            ],
          },
          { value: 'enabled', label: t('common.enabled'), type: 'boolean' },
          { value: 'id', label: 'ID', type: 'number' },
        ]}
        onSubmit={(payload) => {
          setPage(1)
          setToolbarQuery(payload)
        }}
      />

      <div className="pt-1">
        <PaginationBar pagination={pagination} loading={loading} onPrev={goPrev} onNext={goNext} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardContent className="p-0">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-muted-foreground">
                  <SortableHeader
                    column="name"
                    label={t('externalResolvers.name')}
                    sortBy={sortState.sortBy}
                    sortDir={sortState.sortDir}
                    onSort={(c) => setSortState((s) => nextSortState(s, c))}
                  />
                  <SortableHeader
                    column="provider"
                    label={t('externalResolvers.provider')}
                    sortBy={sortState.sortBy}
                    sortDir={sortState.sortDir}
                    onSort={(c) => setSortState((s) => nextSortState(s, c))}
                  />
                  <SortableHeader
                    column="mode"
                    label={t('externalResolvers.mode')}
                    sortBy={sortState.sortBy}
                    sortDir={sortState.sortDir}
                    onSort={(c) => setSortState((s) => nextSortState(s, c))}
                  />
                  <SortableHeader
                    column="enabled"
                    label={t('common.enabled')}
                    sortBy={sortState.sortBy}
                    sortDir={sortState.sortDir}
                    onSort={(c) => setSortState((s) => nextSortState(s, c))}
                  />
                  <th className="px-4 py-3 text-end font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5}>
                      <Loading fullScreen={false} />
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <NoResult fullScreen={false} />
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr
                      key={row.id}
                      className="group border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                      onClick={() => navigate(`/external-resolvers/${row.id}`)}
                    >
                      <td className="px-4 py-3 font-medium">
                        <Link
                          to={`/external-resolvers/${row.id}`}
                          className="hover:underline cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{row.provider}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {t(`externalResolvers.modes.${row.mode}`, { defaultValue: row.mode })}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={row.enabled ? 'success' : 'muted'}>
                          {row.enabled ? t('common.enabled') : t('common.disabled')}
                        </Badge>
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
                          onToggle={() => void handleToggle(row)}
                          onEdit={() => {
                            setEditRow(row)
                            setFormOpen(true)
                          }}
                          onDelete={() => void handleDelete(row)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden divide-y">
            {loading ? (
              <Loading fullScreen={false} />
            ) : items.length === 0 ? (
              <NoResult fullScreen={false} />
            ) : (
              items.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 p-4 cursor-pointer"
                  onClick={() => navigate(`/external-resolvers/${row.id}`)}
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium truncate">{row.name}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">{row.provider}</Badge>
                      <Badge variant={row.enabled ? 'success' : 'muted'}>
                        {row.enabled ? t('common.enabled') : t('common.disabled')}
                      </Badge>
                    </div>
                  </div>
                  <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                    <RowActions
                      row={row}
                      canWrite={canWrite}
                      actionLoading={actionLoading === row.id}
                      onToggle={() => void handleToggle(row)}
                      onEdit={() => {
                        setEditRow(row)
                        setFormOpen(true)
                      }}
                      onDelete={() => void handleDelete(row)}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <ResolverFormModal
        open={formOpen}
        edit={editRow}
        onClose={() => setFormOpen(false)}
        onSaved={() => void load()}
      />
    </div>
  )
}
