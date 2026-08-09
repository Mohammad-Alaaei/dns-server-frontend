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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listRecords({ page, limit })
      setItems(data.items)
      setPagination(data.pagination)
    } catch {
      setError(t('common.error'))
      setItems([])
      setPagination(null)
    } finally {
      setLoading(false)
    }
  }, [page, limit, t])

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

      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="ps-9" placeholder={t('common.search')} disabled />
        </div>
        <Button variant="outline" disabled>
          {t('common.sort')}
        </Button>
        <Button variant="outline" disabled>
          {t('common.filter')}
        </Button>
      </div>

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
                  <th className="px-4 py-3 text-start font-medium">{t('records.domain')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('records.source')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('records.enabled')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('records.hits')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('records.lastHit')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('records.updated')}</th>
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
