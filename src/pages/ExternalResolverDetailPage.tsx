import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  MoreHorizontal,
  MoreVertical,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  deleteExternalResolver,
  deleteExternalResolverKey,
  formatRemaining,
  getExternalResolver,
  keyRemaining,
  resetExternalResolverKeyUsage,
  syncExternalResolverUsage,
  updateExternalResolver,
  updateExternalResolverKey,
  type ExternalResolver,
  type ExternalResolverKey,
} from '@/api/external-resolvers'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { Loading } from '@/components/Loading'
import { NoResult } from '@/components/NoResult'
import { ResolverFormModal } from '@/components/external-resolvers/ResolverFormModal'
import { KeyFormModal } from '@/components/external-resolvers/KeyFormModal'
import { RelativeTime } from '@/components/RelativeTime'

function maskKey(key: string): string {
  const s = key.trim()
  if (s.length <= 8) return '••••'
  return `${s.slice(0, 4)}…${s.slice(-4)}`
}

export default function ExternalResolverDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const canWrite = hasRole('superadmin', 'admin')
  const resolverId = Number(id)

  const [resolver, setResolver] = useState<ExternalResolver | null>(null)
  const [keys, setKeys] = useState<ExternalResolverKey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [keyFormOpen, setKeyFormOpen] = useState(false)
  const [editKey, setEditKey] = useState<ExternalResolverKey | null>(null)

  const load = useCallback(async () => {
    if (!Number.isFinite(resolverId) || resolverId < 1) {
      setError(t('common.error'))
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await getExternalResolver(resolverId)
      setResolver(data)
      setKeys(data.keys ?? [])
    } catch {
      setError(t('common.error'))
      setResolver(null)
      setKeys([])
    } finally {
      setLoading(false)
    }
  }, [resolverId, t])

  useEffect(() => {
    void load()
  }, [load])

  function handleBack() {
    if (window.history.length > 1) navigate(-1)
    else navigate('/external-resolvers')
  }

  async function handleToggleEnabled() {
    if (!resolver || !canWrite) return
    setActionLoading(true)
    try {
      const updated = await updateExternalResolver(resolver.id, {
        enabled: !resolver.enabled,
      })
      setResolver(updated)
      setKeys(updated.keys ?? keys)
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { data?: { error?: string } } }).response?.data?.error
      setError(typeof msg === 'string' ? msg : t('common.error'))
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDeleteResolver() {
    if (!resolver || !canWrite) return
    if (!window.confirm(t('externalResolvers.deleteConfirm', { name: resolver.name }))) return
    setActionLoading(true)
    try {
      await deleteExternalResolver(resolver.id)
      navigate('/external-resolvers', { replace: true })
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { data?: { error?: string } } }).response?.data?.error
      setError(typeof msg === 'string' ? msg : t('common.error'))
      setActionLoading(false)
    }
  }

  async function handleToggleKey(key: ExternalResolverKey) {
    if (!canWrite) return
    try {
      await updateExternalResolverKey(resolverId, key.id, { enabled: !key.enabled })
      await load()
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { data?: { error?: string } } }).response?.data?.error
      setError(typeof msg === 'string' ? msg : t('common.error'))
    }
  }

  async function handleDeleteKey(key: ExternalResolverKey) {
    if (!canWrite) return
    if (!window.confirm(t('externalResolvers.deleteKeyConfirm'))) return
    try {
      await deleteExternalResolverKey(resolverId, key.id)
      await load()
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { data?: { error?: string } } }).response?.data?.error
      setError(typeof msg === 'string' ? msg : t('common.error'))
    }
  }

  async function handleResetUsage(key: ExternalResolverKey) {
    if (!canWrite) return
    try {
      await resetExternalResolverKeyUsage(resolverId, key.id)
      await load()
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { data?: { error?: string } } }).response?.data?.error
      setError(typeof msg === 'string' ? msg : t('common.error'))
    }
  }

  async function handleSyncUsage() {
    if (!canWrite) return
    setActionLoading(true)
    setError('')
    try {
      await syncExternalResolverUsage(resolverId)
      await load()
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { data?: { error?: string } } }).response?.data?.error
      setError(typeof msg === 'string' ? msg : t('common.error'))
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return <Loading />

  if (error || !resolver) {
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
          { label: t('nav.externalResolvers'), to: '/external-resolvers' },
          { label: resolver.name },
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
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{resolver.name}</h1>
            <Badge variant="secondary">{resolver.provider}</Badge>
            <Badge variant={resolver.enabled ? 'success' : 'muted'}>
              {resolver.enabled ? t('common.enabled') : t('common.disabled')}
            </Badge>
            <Badge variant="outline">
              {t(`externalResolvers.modes.${resolver.mode}`, { defaultValue: resolver.mode })}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canWrite && (
            <Button
              variant="outline"
              disabled={actionLoading}
              onClick={() => void handleSyncUsage()}
            >
              <RefreshCw className="h-4 w-4" />
              {t('externalResolvers.syncUsage')}
            </Button>
          )}
          <DropdownMenu
            trigger={
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 cursor-pointer"
                aria-label={t('common.actions')}
              >
                <MoreHorizontal className="hidden h-4 w-4 md:block" />
                <MoreVertical className="h-4 w-4 md:hidden" />
              </Button>
            }
          >
            {canWrite && (
              <DropdownMenuItem onClick={() => void handleToggleEnabled()}>
                {resolver.enabled ? (
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
              <DropdownMenuItem onClick={() => setFormOpen(true)}>
                <Pencil className="h-4 w-4" />
                {t('common.edit')}
              </DropdownMenuItem>
            )}
            {canWrite && (
              <DropdownMenuItem onClick={() => void handleDeleteResolver()} destructive>
                <Trash2 className="h-4 w-4" />
                {t('common.delete')}
              </DropdownMenuItem>
            )}
          </DropdownMenu>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t('externalResolvers.keysTitle')}</CardTitle>
          {canWrite && (
            <Button
              size="sm"
              onClick={() => {
                setEditKey(null)
                setKeyFormOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              {t('externalResolvers.addKey')}
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {keys.length === 0 ? (
            <div className="p-6">
              <NoResult fullScreen={false} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-muted-foreground">
                    <th className="px-4 py-3 text-start font-medium">{t('externalResolvers.priority')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('externalResolvers.keyLabel')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('externalResolvers.apiKey')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('externalResolvers.usage')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('common.enabled')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('externalResolvers.lastUsed')}</th>
                    <th className="px-4 py-3 text-end font-medium">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((key) => {
                    const rem = keyRemaining(key)
                    return (
                      <tr key={key.id} className="border-b last:border-0">
                        <td className="px-4 py-3 tabular-nums">{key.priority}</td>
                        <td className="px-4 py-3">{key.label || '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs">{maskKey(key.api_key)}</td>
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">
                          {formatRemaining(rem)}
                          {key.period_limit > 0 ? ` / ${key.period_limit}` : ''}
                          {key.last_error && (
                            <span className="block text-xs text-destructive truncate max-w-[12rem]" title={key.last_error}>
                              {key.last_error}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={key.enabled ? 'success' : 'muted'}>
                            {key.enabled ? t('common.enabled') : t('common.disabled')}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {key.last_used_at ? <RelativeTime value={key.last_used_at} /> : '—'}
                        </td>
                        <td className="px-4 py-3 text-end">
                          {canWrite && (
                            <DropdownMenu
                              align="end"
                              trigger={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={t('common.actions')}
                                  className="cursor-pointer"
                                >
                                  <MoreHorizontal className="hidden h-4 w-4 md:block" />
                                  <MoreVertical className="h-4 w-4 md:hidden" />
                                </Button>
                              }
                            >
                              <DropdownMenuItem onClick={() => void handleToggleKey(key)}>
                                {key.enabled ? (
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
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditKey(key)
                                  setKeyFormOpen(true)
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                                {t('common.edit')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => void handleResetUsage(key)}>
                                <RotateCcw className="h-4 w-4" />
                                {t('externalResolvers.resetUsage')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => void handleDeleteKey(key)} destructive>
                                <Trash2 className="h-4 w-4" />
                                {t('common.delete')}
                              </DropdownMenuItem>
                            </DropdownMenu>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ResolverFormModal
        open={formOpen}
        edit={resolver}
        onClose={() => setFormOpen(false)}
        onSaved={() => void load()}
      />
      <KeyFormModal
        open={keyFormOpen}
        resolverId={resolverId}
        edit={editKey}
        onClose={() => setKeyFormOpen(false)}
        onSaved={() => void load()}
      />
    </div>
  )
}
