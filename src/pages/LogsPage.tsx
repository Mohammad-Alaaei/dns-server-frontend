import { useCallback, useEffect, useState } from 'react'
import { usePersistedListState } from '@/hooks/usePersistedListState'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { listLogFiles, type LogFileItem } from '@/api/logs'
import type { PaginationMeta } from '@/api/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loading } from '@/components/Loading'
import { NoResult } from '@/components/NoResult'
import { PaginationBar } from '@/components/PaginationBar'
import { ListToolbar } from '@/components/ListToolbar'
import { RelativeTime } from '@/components/RelativeTime'

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export default function LogsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [items, setItems] = useState<LogFileItem[]>([])
  const [pagination, setPagination] = useState<PaginationMeta | null>(null)
  const [limit] = useState(20)
  const { page, setPage } =
    usePersistedListState('logs', {
      page: 1,
      toolbarQuery: { search: '', searchField: 'name', filters: [], filterLogic: 'AND' },
      sortState: { sortBy: null, sortDir: null },
    })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listLogFiles({ page, limit })
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

  function goPrev() {
    setPage((p) => Math.max(1, p - 1))
  }
  function goNext() {
    setPage((p) => p + 1)
  }

  function openLog(name: string) {
    navigate(`/logs/${encodeURIComponent(name)}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('logs.title')}</h1>
      </div>

      <ListToolbar
        searchFields={[{ value: 'name', label: t('logs.filename') }]}
        showFilter={false}
        onSubmit={() => {
          /* logs list API has no search yet */
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
                  <th className="px-4 py-3 text-start font-medium">{t('logs.filename')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('logs.size')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('logs.modified')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('logs.status')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4}>
                      <Loading fullScreen={false} />
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <NoResult fullScreen={false} />
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr
                      key={row.name}
                      className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                      onClick={() => openLog(row.name)}
                    >
                      <td className="px-4 py-3 font-medium font-mono text-xs">
                        <Link
                          to={`/logs/${encodeURIComponent(row.name)}`}
                          className="hover:underline cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {formatBytes(row.size)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <RelativeTime value={row.mtime} />
                      </td>
                      <td className="px-4 py-3">
                        {row.current ? (
                          <Badge variant="success">{t('logs.current')}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y">
            {loading ? (
              <Loading fullScreen={false} />
            ) : items.length === 0 ? (
              <NoResult fullScreen={false} />
            ) : (
              items.map((row) => (
                <div
                  key={row.name}
                  className="flex items-start gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => openLog(row.name)}
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-mono text-xs font-medium truncate">{row.name}</p>
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {row.current && <Badge variant="success">{t('logs.current')}</Badge>}
                      <span className="text-xs text-muted-foreground">
                        {formatBytes(row.size)} · <RelativeTime value={row.mtime} />
                      </span>
                    </div>
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
    </div>
  )
}
