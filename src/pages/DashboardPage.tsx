import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Activity,
  Clock,
  Database,
  Layers,
  RefreshCw,
  Server,
  Zap,
} from 'lucide-react'
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts'
import { useAuth } from '@/contexts/AuthContext'
import {
  getStatisticsSummary,
  getTopRecords,
  getStatsDnsServers,
  type StatisticsSummary,
  type TopRecordItem,
  type StatsDnsServerItem,
} from '@/api/statistics'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loading } from '@/components/Loading'
import { RelativeTime } from '@/components/RelativeTime'
import { cn } from '@/lib/utils'

const REFRESH_OPTIONS = [3, 5, 10, 30, 60] as const
const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4']
const SUCCESS_COLOR = '#22c55e'
const FAILURE_COLOR = '#ef4444'
const TIMEOUT_COLOR = '#f59e0b'
const LATENCY_COLOR = '#3b82f6'

function formatUptime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '—'
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function successRate(u: StatisticsSummary['upstream']): number {
  const total = u.successes + u.failures + u.timeouts
  if (total <= 0) return 0
  return Math.round((u.successes / total) * 1000) / 10
}

export default function DashboardPage() {
  const { t } = useTranslation()
  const { user } = useAuth()

  const [summary, setSummary] = useState<StatisticsSummary | null>(null)
  const [topBy, setTopBy] = useState<'hits' | 'last_hit'>('hits')
  const [topItems, setTopItems] = useState<TopRecordItem[]>([])
  const [servers, setServers] = useState<StatsDnsServerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshSec, setRefreshSec] = useState(() => {
    try {
      const raw = localStorage.getItem('dashboard.refreshSec')
      const n = raw != null ? Number(raw) : 10
      return [3, 5, 10, 30, 60].includes(n) ? n : 10
    } catch {
      return 10
    }
  })
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      setError('')
      try {
        const [sum, top, dns] = await Promise.all([
          getStatisticsSummary(),
          getTopRecords({ by: topBy, limit: 10 }),
          getStatsDnsServers({ page: 1, limit: 12 }),
        ])
        setSummary(sum)
        setTopItems(top.items)
        setServers(dns.items)
        setLastUpdated(Date.now())
      } catch {
        setError(t('common.error'))
      } finally {
        setLoading(false)
      }
    },
    [topBy, t]
  )

  useEffect(() => {
    void load(false)
  }, [load])

  useEffect(() => {
    if (refreshSec <= 0) return
    const id = window.setInterval(() => {
      void load(true)
    }, refreshSec * 1000)
    return () => window.clearInterval(id)
  }, [refreshSec, load])

  const sourceChart = useMemo(() => {
    if (!summary) return []
    return Object.entries(summary.records.bySource).map(([name, value]) => ({
      name,
      value: Number(value) || 0,
    }))
  }, [summary])

  const upstreamChart = useMemo(() => {
    if (!summary) return []
    return [
      { name: t('dashboard.successes'), value: summary.upstream.successes },
      { name: t('dashboard.failures'), value: summary.upstream.failures },
      { name: t('dashboard.timeouts'), value: summary.upstream.timeouts },
    ]
  }, [summary, t])

  const serverOutcomeData = useMemo(
    () =>
      servers.map((s) => ({
        id: s.id,
        label: s.ip,
        type: s.type,
        enabled: s.enabled,
        successes: s.successes,
        failures: s.failures,
        timeouts: s.timeouts,
        latency: Number(s.average_latency) || 0,
      })),
    [servers]
  )

  const topBarData = useMemo(
    () =>
      topItems.map((r) => ({
        id: r.id,
        domain: r.domain.length > 36 ? r.domain.slice(0, 34) + '…' : r.domain,
        fullDomain: r.domain,
        value: topBy === 'hits' ? r.hits : (r.last_hit ?? 0),
      })),
    [topItems, topBy]
  )

  if (loading && !summary) {
    return <Loading />
  }

  return (
    <div className="space-y-6 dashboard-charts">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-muted-foreground text-sm">
            {t('dashboard.welcome')}, {user?.username}
            {summary && (
              <span className="ms-2">
                · {t('dashboard.uptime')}: {formatUptime(summary.process.uptimeSec)}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{t('dashboard.refresh')}</span>
            <select
              className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
              value={refreshSec}
              onChange={(e) => {
                const n = Number(e.target.value)
                setRefreshSec(n)
                try {
                  localStorage.setItem('dashboard.refreshSec', String(n))
                } catch {
                  /* ignore */
                }
              }}
            >
              {REFRESH_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}s
                </option>
              ))}
            </select>
          </label>
          <Button variant="outline" size="sm" disabled={loading} onClick={() => void load(false)}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            {t('dashboard.refreshNow')}
          </Button>
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              <RelativeTime value={lastUpdated} />
            </span>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* KPIs — equal height */}
      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-stretch">
          <Kpi
            icon={Database}
            label={t('dashboard.totalRecords')}
            value={summary.records.total}
            hint={`${summary.records.enabled} ${t('common.enabled').toLowerCase()}`}
            to="/records"
          />
          <Kpi
            icon={Zap}
            label={t('dashboard.totalHits')}
            value={summary.records.totalHits}
            to="/records"
          />
          <Kpi
            icon={Activity}
            label={t('dashboard.successRate')}
            value={`${successRate(summary.upstream)}%`}
            hint={`${summary.upstream.successes} / ${summary.upstream.successes + summary.upstream.failures + summary.upstream.timeouts}`}
            to="/servers"
          />
          <Kpi
            icon={Clock}
            label={t('dashboard.avgLatency')}
            value={`${summary.upstream.avgLatencyMs}`}
            unit="ms"
            to="/servers"
          />
          <Kpi
            icon={Layers}
            label={t('dashboard.pendingCache')}
            value={summary.memory.pendingCache}
            to="/memory?tab=pending"
          />
        </div>
      )}

      {/* Charts — 2 columns */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('dashboard.recordsBySource')}</CardTitle>
            </CardHeader>
            <CardContent className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceChart}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={2}
                  >
                    {sourceChart.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid hsl(var(--border))',
                      background: 'hsl(var(--card))',
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3 -mt-1">
                {sourceChart.map((s, i) => (
                  <span
                    key={s.name}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    {s.name}: {s.value}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('dashboard.upstreamMix')}</CardTitle>
            </CardHeader>
            <CardContent className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={upstreamChart}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={2}
                  >
                    <Cell fill={SUCCESS_COLOR} />
                    <Cell fill={FAILURE_COLOR} />
                    <Cell fill={TIMEOUT_COLOR} />
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid hsl(var(--border))',
                      background: 'hsl(var(--card))',
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3 -mt-1">
                {upstreamChart.map((s, i) => {
                  const color =
                    i === 0 ? SUCCESS_COLOR : i === 1 ? FAILURE_COLOR : TIMEOUT_COLOR
                  return (
                    <span
                      key={s.name}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground"
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                      {s.name}: {s.value}
                    </span>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Upstream health — stacked outcomes + latency bars */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Server className="h-4 w-4" />
            {t('dashboard.upstreamHealth')}
          </CardTitle>
          <Link to="/servers" className="text-xs text-primary hover:underline">
            {t('dashboard.viewAll')}
          </Link>
        </CardHeader>
        <CardContent>
          {serverOutcomeData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{t('common.noResults')}</p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  {t('dashboard.outcomesPerServer')}
                </p>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={serverOutcomeData}
                      layout="vertical"
                      margin={{ left: 4, right: 12, top: 4, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={100}
                        tick={{ fontSize: 10, fontFamily: 'monospace' }}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 8,
                          border: '1px solid hsl(var(--border))',
                          background: 'hsl(var(--card))',
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar
                        dataKey="successes"
                        stackId="a"
                        name={t('dashboard.successes')}
                        fill={SUCCESS_COLOR}
                        radius={[0, 0, 0, 0]}
                      />
                      <Bar
                        dataKey="failures"
                        stackId="a"
                        name={t('dashboard.failures')}
                        fill={FAILURE_COLOR}
                      />
                      <Bar
                        dataKey="timeouts"
                        stackId="a"
                        name={t('dashboard.timeouts')}
                        fill={TIMEOUT_COLOR}
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  {t('dashboard.latencyPerServer')}
                </p>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={serverOutcomeData}
                      layout="vertical"
                      margin={{ left: 4, right: 12, top: 4, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11 }}
                        unit=" ms"
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={100}
                        tick={{ fontSize: 10, fontFamily: 'monospace' }}
                      />
                      <Tooltip
                        formatter={(value) => [`${Number(value).toFixed(1)} ms`, t('servers.latency')]}
                        contentStyle={{
                          borderRadius: 8,
                          border: '1px solid hsl(var(--border))',
                          background: 'hsl(var(--card))',
                          fontSize: 12,
                        }}
                      />
                      <Bar
                        dataKey="latency"
                        name={t('servers.latency')}
                        fill={LATENCY_COLOR}
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
          {/* Quick links under charts */}
          {servers.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
              {servers.map((s) => (
                <Link key={s.id} to={`/servers/${s.id}`}>
                  <Badge
                    variant={s.enabled ? 'outline' : 'muted'}
                    className="cursor-pointer font-mono text-[10px] hover:bg-muted"
                  >
                    {s.ip}
                    {!s.enabled && ` · ${t('common.disabled')}`}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top domains — full width */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 gap-2">
          <CardTitle className="text-sm font-medium">{t('dashboard.topDomains')}</CardTitle>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={topBy === 'hits' ? 'default' : 'outline'}
              className="h-7 text-xs"
              onClick={() => setTopBy('hits')}
            >
              {t('dashboard.byHits')}
            </Button>
            <Button
              size="sm"
              variant={topBy === 'last_hit' ? 'default' : 'outline'}
              className="h-7 text-xs"
              onClick={() => setTopBy('last_hit')}
            >
              {t('dashboard.byLastHit')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {topBarData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{t('common.noResults')}</p>
          ) : topBy === 'hits' ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topBarData} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="domain" width={180} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => [value, t('dashboard.hits')]}
                    labelFormatter={(_, payload) =>
                      (payload?.[0]?.payload as { fullDomain?: string })?.fullDomain ?? ''
                    }
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid hsl(var(--border))',
                      background: 'hsl(var(--card))',
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="value" fill={PIE_COLORS[0]} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ul className="divide-y">
              {topItems.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <Link
                    to={`/records/${r.id}`}
                    className="font-mono text-xs truncate hover:underline min-w-0"
                  >
                    {r.domain}
                  </Link>
                  <RelativeTime value={r.last_hit} />
                </li>
              ))}
            </ul>
          )}
          {topBy === 'hits' && topItems.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
              {topItems.map((r) => (
                <Link key={r.id} to={`/records/${r.id}`}>
                  <Badge variant="outline" className="cursor-pointer font-mono text-[10px] hover:bg-muted">
                    {r.domain} · {r.hits}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Memory snapshot */}
      {summary && (
        <div className="flex flex-wrap gap-2">
          <Link to="/memory?tab=exact">
            <Badge variant="outline" className="cursor-pointer hover:bg-muted">
              {t('memory.exactRecords')}: {summary.memory.exactRecords}
            </Badge>
          </Link>
          <Link to="/memory?tab=regex">
            <Badge variant="outline" className="cursor-pointer hover:bg-muted">
              {t('memory.regexRecords')}: {summary.memory.regexRecords}
            </Badge>
          </Link>
          <Link to="/memory?tab=defaultServers">
            <Badge variant="outline" className="cursor-pointer hover:bg-muted">
              {t('memory.defaultServers')}: {summary.memory.defaultDnsServers}
            </Badge>
          </Link>
          <Link to="/memory?tab=customServers">
            <Badge variant="outline" className="cursor-pointer hover:bg-muted">
              {t('memory.customServers')}: {summary.memory.customDnsServers}
            </Badge>
          </Link>
          <Link to="/memory?tab=pending">
            <Badge variant="outline" className="cursor-pointer hover:bg-muted">
              {t('dashboard.pendingCache')}: {summary.memory.pendingCache}
            </Badge>
          </Link>
        </div>
      )}
    </div>
  )
}

function Kpi({
  icon: Icon,
  label,
  value,
  unit,
  hint,
  to,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string | number
  unit?: string
  hint?: string
  to?: string
}) {
  const inner = (
    <Card
      className={cn(
        'h-full flex flex-col',
        to && 'transition-colors hover:bg-muted/40 cursor-pointer'
      )}
    >
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between min-h-[4.25rem]">
        <p className="text-2xl font-semibold tabular-nums">
          {value}
          {unit && (
            <span className="ms-1 text-sm font-normal text-muted-foreground">{unit}</span>
          )}
        </p>
        {/* Reserve hint line so all cards share height even when some omit hint */}
        <p className="text-[11px] text-muted-foreground mt-0.5 min-h-[1rem]">
          {hint ?? '\u00a0'}
        </p>
      </CardContent>
    </Card>
  )
  return to ? (
    <Link to={to} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
  )
}
