import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  Power,
  PowerOff,
  Pencil,
  Trash2,
  MoreHorizontal,
  MoreVertical,
  Plus,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  getDnsServer,
  updateDnsServer,
  listDnsServerRules,
  type DnsServerDetail,
  type DnsRuleItem,
} from '@/api/dns-servers'
import type { PaginationMeta } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { Loading } from '@/components/Loading'

function typeBadgeVariant(type: string) {
  return type === 'DEFAULT' ? ('success' as const) : ('secondary' as const)
}

export default function ServerDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const canWrite = hasRole('superadmin')

  const serverId = Number(id)

  const [server, setServer] = useState<DnsServerDetail | null>(null)
  const [rules, setRules] = useState<DnsRuleItem[]>([])
  const [rulesPagination, setRulesPagination] = useState<PaginationMeta | null>(null)
  const [rulesPage, setRulesPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [rulesLoading, setRulesLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const loadServer = useCallback(async () => {
    if (!Number.isFinite(serverId) || serverId < 1) {
      setError(t('common.error'))
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const s = await getDnsServer(serverId)
      setServer(s)
    } catch {
      setError(t('common.error'))
      setServer(null)
    } finally {
      setLoading(false)
    }
  }, [serverId, t])

  const loadRules = useCallback(async () => {
    if (!Number.isFinite(serverId) || serverId < 1) return
    setRulesLoading(true)
    try {
      const data = await listDnsServerRules(serverId, { page: rulesPage, limit: 20 })
      setRules(data.items)
      setRulesPagination(data.pagination)
    } catch {
      setRules([])
      setRulesPagination(null)
    } finally {
      setRulesLoading(false)
    }
  }, [serverId, rulesPage])

  useEffect(() => {
    loadServer()
  }, [loadServer])

  useEffect(() => {
    loadRules()
  }, [loadRules])

  function handleBack() {
    if (window.history.length > 1) navigate(-1)
    else navigate('/servers')
  }

  async function handleToggleEnabled() {
    if (!server || !canWrite) return
    setActionLoading(true)
    try {
      const updated = await updateDnsServer(server.id, { enabled: !server.enabled })
      setServer(updated)
    } catch {
      setError(t('common.error'))
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return <Loading />
  }

  if (error || !server) {
    return (
      <div className="space-y-4">
        <Button
          variant="secondary"
          className="cursor-pointer bg-muted hover:bg-muted/80"
          onClick={handleBack}
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </Button>
        <p className="text-destructive">{error || t('common.error')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: t('nav.servers'), to: '/servers' },
          { label: server.ip },
        ]}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button
            variant="secondary"
            className="cursor-pointer bg-muted hover:bg-muted/80 font-medium"
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4" />
            {t('common.back')}
          </Button>
          <h1 className="text-2xl font-bold tracking-tight font-mono">{server.ip}</h1>
          <div className="flex flex-wrap gap-2">
            <Badge variant={typeBadgeVariant(server.type)}>{server.type}</Badge>
            <Badge variant={server.enabled ? 'success' : 'muted'}>
              {server.enabled ? t('common.enabled') : t('common.disabled')}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canWrite && (
            <Button
              variant="outline"
              size="sm"
              disabled={actionLoading}
              onClick={handleToggleEnabled}
            >
              {server.enabled ? (
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
            </Button>
          )}
          <DropdownMenu
            trigger={
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label={t('common.actions')}
              >
                <MoreHorizontal className="hidden h-4 w-4 md:block" />
                <MoreVertical className="h-4 w-4 md:hidden" />
              </Button>
            }
          >
            <DropdownMenuItem disabled>
              <Pencil className="h-4 w-4" />
              {t('common.edit')}
            </DropdownMenuItem>
          </DropdownMenu>
        </div>
      </div>

      <div className="border-t" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t('servers.priority')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{server.priority}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t('servers.latency')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {Number(server.average_latency).toFixed(1)}
              <span className="ms-1 text-sm font-normal text-muted-foreground">ms</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t('servers.successes')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {server.successes}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t('servers.failures')} / {t('servers.timeouts')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              <span className="text-destructive">{server.failures}</span>
              <span className="text-muted-foreground mx-1">/</span>
              <span className="text-amber-600 dark:text-amber-400">{server.timeouts}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Rules */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">{t('servers.rules')}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{t('servers.rulesHint')}</p>
          </div>
          <Button size="sm" disabled={!canWrite} title={t('common.comingSoon')}>
            <Plus className="h-4 w-4" />
            {t('servers.addRule')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {rulesPagination && rulesPagination.totalPages > 0 && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground">
              <span>
                {t('common.page')} {rulesPagination.page} {t('common.of')}{' '}
                {rulesPagination.totalPages}
                {' · '}
                {rulesPagination.total} {t('servers.rulesTotal')}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!rulesPagination.hasPrev || rulesLoading}
                  onClick={() => setRulesPage((p) => Math.max(1, p - 1))}
                >
                  {t('common.previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!rulesPagination.hasNext || rulesLoading}
                  onClick={() => setRulesPage((p) => p + 1)}
                >
                  {t('common.next')}
                </Button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-muted-foreground">
                  <th className="px-3 py-2 text-start font-medium">{t('servers.ruleDomain')}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('servers.ruleRegex')}</th>
                  <th className="px-3 py-2 text-end font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rulesLoading ? (
                  <tr>
                    <td colSpan={3}>
                      <Loading fullScreen={false} />
                    </td>
                  </tr>
                ) : rules.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-10 text-center text-muted-foreground">
                      {t('common.noResults')}
                    </td>
                  </tr>
                ) : (
                  rules.map((rule) => (
                    <tr key={rule.id} className="border-b last:border-0">
                      <td className="px-3 py-2 font-mono text-xs break-all">{rule.domain}</td>
                      <td className="px-3 py-2">
                        {rule.is_regex ? (
                          <Badge variant="outline" className="text-[10px]">
                            regex
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-end">
                        <DropdownMenu
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={t('common.actions')}
                            >
                              <MoreHorizontal className="hidden h-4 w-4 md:block" />
                              <MoreVertical className="h-4 w-4 md:hidden" />
                            </Button>
                          }
                        >
                          <DropdownMenuItem disabled>
                            <Pencil className="h-4 w-4" />
                            {t('common.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled destructive>
                            <Trash2 className="h-4 w-4" />
                            {t('common.delete')}
                          </DropdownMenuItem>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {rulesPagination && rulesPagination.totalPages > 0 && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground">
              <span>
                {t('common.page')} {rulesPagination.page} {t('common.of')}{' '}
                {rulesPagination.totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!rulesPagination.hasPrev || rulesLoading}
                  onClick={() => setRulesPage((p) => Math.max(1, p - 1))}
                >
                  {t('common.previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!rulesPagination.hasNext || rulesLoading}
                  onClick={() => setRulesPage((p) => p + 1)}
                >
                  {t('common.next')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
