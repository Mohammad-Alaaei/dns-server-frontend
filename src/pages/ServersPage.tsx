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
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Loading } from '@/components/Loading'
import { NoResult } from '@/components/NoResult'

function typeBadgeVariant(type: string) {
  return type === 'DEFAULT' ? ('success' as const) : ('secondary' as const)
}

function PaginationBar({
  pagination,
  loading,
  onPrev,
  onNext,
  totalLabel,
}: {
  pagination: PaginationMeta
  loading: boolean
  onPrev: () => void
  onNext: () => void
  totalLabel: string
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground">
      <span>
        {t('common.page')} {pagination.page} {t('common.of')} {pagination.totalPages}
        {' · '}
        {pagination.total} {totalLabel}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!pagination.hasPrev || loading}
          onClick={onPrev}
        >
          {t('common.previous')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!pagination.hasNext || loading}
          onClick={onNext}
        >
          {t('common.next')}
        </Button>
      </div>
    </div>
  )
}

function RowActions({
  row,
  canWrite,
  actionLoading,
  onView,
  onToggle,
}: {
  row: DnsServerListItem
  canWrite: boolean
  actionLoading: boolean
  onView: () => void
  onToggle: () => void
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
        >
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
      <DropdownMenuItem disabled>
        <Pencil className="h-4 w-4" />
        {t('common.edit')}
      </DropdownMenuItem>
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
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listDnsServers({ page, limit })
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

  async function handleToggleEnabled(row: DnsServerListItem) {
    if (!canWrite) return
    setActionLoading(row.id)
    try {
      await updateDnsServer(row.id, { enabled: !row.enabled })
      await load()
    } catch {
      setError(t('common.error'))
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
        <h1 className="text-2xl font-bold tracking-tight">{t('servers.title')}</h1>
        <Button disabled={!canWrite} title={!canWrite ? undefined : t('common.comingSoon')}>
          <Plus className="h-4 w-4" />
          {t('common.create')}
        </Button>
      </div>

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

      {pagination && pagination.totalPages > 0 && (
        <div className="pt-1">
          <PaginationBar
            pagination={pagination}
            loading={loading}
            onPrev={goPrev}
            onNext={goNext}
            totalLabel={t('servers.total')}
          />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardContent className="p-0">
          <div className="hidden md:block overflow-x-auto">
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
                      onClick={() => navigate(`/servers/${row.id}`)}
                    >
                      <td className="px-4 py-3 font-medium font-mono">
                        <Link
                          to={`/servers/${row.id}`}
                          className="hover:underline cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.ip}
                        </Link>
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
                          onView={() => navigate(`/servers/${row.id}`)}
                          onToggle={() => handleToggleEnabled(row)}
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
                  className="flex items-start gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => navigate(`/servers/${row.id}`)}
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-medium font-mono truncate">{row.ip}</p>
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
                      onView={() => navigate(`/servers/${row.id}`)}
                      onToggle={() => handleToggleEnabled(row)}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {pagination && pagination.totalPages > 0 && (
        <PaginationBar
          pagination={pagination}
          loading={loading}
          onPrev={goPrev}
          onNext={goNext}
          totalLabel={t('servers.total')}
        />
      )}
    </div>
  )
}
