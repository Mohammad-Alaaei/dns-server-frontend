import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MoreHorizontal,
  MoreVertical,
  Power,
  PowerOff,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  listRewriteRules,
  updateRewriteRule,
  deleteRewriteRule,
  type RewriteRuleItem,
} from '@/api/rewrite-rules'
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
import { RewriteRuleFormModal } from '@/components/rewrite/RewriteRuleFormModal'

function actionBadgeVariant(action: string) {
  return action === 'cname_rewrite' ? ('success' as const) : ('secondary' as const)
}

function formatTemplate(params: Record<string, unknown> | null | undefined): string {
  if (!params || typeof params !== 'object') return '—'
  const t = params.template
  return typeof t === 'string' && t.trim() ? t : '—'
}

function RowActions({
  row,
  canWrite,
  actionLoading,
  onToggle,
  onEdit,
  onDelete,
}: {
  row: RewriteRuleItem
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
              {t('rewriteRules.disable')}
            </>
          ) : (
            <>
              <Power className="h-4 w-4" />
              {t('rewriteRules.enable')}
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

export default function RewriteRulesPage() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const canWrite = hasRole('superadmin', 'admin')

  const [items, setItems] = useState<RewriteRuleItem[]>([])
  const [pagination, setPagination] = useState<PaginationMeta | null>(null)
  const [limit] = useState(20)
  const { page, setPage, toolbarQuery, setToolbarQuery, sortState, setSortState } =
    usePersistedListState('rewrite-rules', {
      page: 1,
      toolbarQuery: {
        search: '',
        searchField: 'pattern',
        filters: [],
        filterLogic: 'AND',
      },
      sortState: { sortBy: null, sortDir: null },
    })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editRule, setEditRule] = useState<RewriteRuleItem | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listRewriteRules({
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
    load()
  }, [load])

  async function handleToggleEnabled(row: RewriteRuleItem) {
    if (!canWrite) return
    setActionLoading(row.id)
    try {
      await updateRewriteRule(row.id, { enabled: !row.enabled })
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

  async function handleDelete(row: RewriteRuleItem) {
    if (!canWrite) return
    const label = row.name || row.pattern
    if (!window.confirm(t('rewriteRules.deleteConfirm', { name: label }))) {
      return
    }
    setActionLoading(row.id)
    try {
      await deleteRewriteRule(row.id)
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
          <h1 className="text-2xl font-bold tracking-tight">{t('rewriteRules.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('rewriteRules.subtitle')}</p>
        </div>
        <Button
          disabled={!canWrite}
          onClick={() => {
            setEditRule(null)
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
          { value: 'pattern', label: t('rewriteRules.pattern') },
          { value: 'name', label: t('rewriteRules.name') },
          { value: 'action', label: t('rewriteRules.action') },
        ]}
        filterFields={[
          { value: 'pattern', label: t('rewriteRules.pattern'), type: 'string' },
          { value: 'name', label: t('rewriteRules.name'), type: 'string' },
          {
            value: 'action',
            label: t('rewriteRules.action'),
            type: 'enum',
            options: [{ value: 'cname_rewrite', label: t('rewriteRules.actions.cname_rewrite') }],
          },
          { value: 'enabled', label: t('rewriteRules.enabled'), type: 'boolean' },
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
                  <SortableHeader
                    column="name"
                    label={t('rewriteRules.name')}
                    sortBy={sortState.sortBy}
                    sortDir={sortState.sortDir}
                    onSort={(c) => setSortState((s) => nextSortState(s, c))}
                  />
                  <SortableHeader
                    column="pattern"
                    label={t('rewriteRules.pattern')}
                    sortBy={sortState.sortBy}
                    sortDir={sortState.sortDir}
                    onSort={(c) => setSortState((s) => nextSortState(s, c))}
                  />
                  <SortableHeader
                    column="action"
                    label={t('rewriteRules.action')}
                    sortBy={sortState.sortBy}
                    sortDir={sortState.sortDir}
                    onSort={(c) => setSortState((s) => nextSortState(s, c))}
                  />
                  <th className="px-4 py-3 text-start font-medium">{t('rewriteRules.template')}</th>
                  <SortableHeader
                    column="enabled"
                    label={t('rewriteRules.enabled')}
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
                    <td colSpan={6}>
                      <Loading fullScreen={false} />
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <NoResult fullScreen={false} />
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr
                      key={row.id}
                      className="group border-b last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 font-medium">
                        {row.name || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs max-w-[280px]">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="truncate" title={row.pattern}>
                            {row.pattern}
                          </span>
                          <CopyButton text={row.pattern} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={actionBadgeVariant(row.action)}>
                          {t(`rewriteRules.actions.${row.action}`, {
                            defaultValue: row.action,
                          })}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {formatTemplate(row.params)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={row.enabled ? 'success' : 'muted'}>
                          {row.enabled ? t('common.enabled') : t('common.disabled')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-end">
                        <RowActions
                          row={row}
                          canWrite={canWrite}
                          actionLoading={actionLoading === row.id}
                          onToggle={() => handleToggleEnabled(row)}
                          onEdit={() => {
                            setEditRule(row)
                            setFormOpen(true)
                          }}
                          onDelete={() => handleDelete(row)}
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
                <div key={row.id} className="group flex items-start gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-medium truncate">
                      {row.name || t('rewriteRules.unnamed')}
                    </p>
                    <p className="font-mono text-xs truncate text-muted-foreground" title={row.pattern}>
                      {row.pattern}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={actionBadgeVariant(row.action)}>
                        {t(`rewriteRules.actions.${row.action}`, {
                          defaultValue: row.action,
                        })}
                      </Badge>
                      <Badge variant={row.enabled ? 'success' : 'muted'}>
                        {row.enabled ? t('common.enabled') : t('common.disabled')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      {t('rewriteRules.template')}: {formatTemplate(row.params)}
                    </p>
                  </div>
                  <div>
                    <RowActions
                      row={row}
                      canWrite={canWrite}
                      actionLoading={actionLoading === row.id}
                      onToggle={() => handleToggleEnabled(row)}
                      onEdit={() => {
                        setEditRule(row)
                        setFormOpen(true)
                      }}
                      onDelete={() => handleDelete(row)}
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

      <RewriteRuleFormModal
        open={formOpen}
        rule={editRule}
        onClose={() => {
          setFormOpen(false)
          setEditRule(null)
        }}
        onSaved={() => void load()}
      />
    </div>
  )
}
