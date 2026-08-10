import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2, Save } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  getSystemSettings,
  patchSystemSettings,
  type SystemSettings,
} from '@/api/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loading } from '@/components/Loading'

const CACHE_LEVELS = ['ALL', 'CUSTOM_ONLY', 'FILTERED_ONLY', 'NONE'] as const

function ipsToText(list: string[] | undefined): string {
  return (list ?? []).join('\n')
}

function textToIps(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function emptyForm(): SystemSettings {
  return {
    cache: {
      level: 'CUSTOM_ONLY',
      expireTime: 60,
      flushInterval: 60000,
      filterIps: [],
    },
    ignoreIps: [],
    dns: { ttl: 60, timeout: 8000 },
    server: { ptrHostname: 'localhost.com', debugPrefix: '_.' },
  }
}

export default function SystemSettingsPage() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const isSuperadmin = hasRole('superadmin')

  const [form, setForm] = useState<SystemSettings>(emptyForm)
  const [filterIpsText, setFilterIpsText] = useState('')
  const [ignoreIpsText, setIgnoreIpsText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const s = await getSystemSettings()
      setForm({
        cache: {
          level: s.cache?.level ?? 'CUSTOM_ONLY',
          expireTime: Number(s.cache?.expireTime ?? 60),
          flushInterval: Number(s.cache?.flushInterval ?? 60000),
          filterIps: Array.isArray(s.cache?.filterIps) ? s.cache.filterIps : [],
        },
        ignoreIps: Array.isArray(s.ignoreIps) ? s.ignoreIps : [],
        dns: {
          ttl: Number(s.dns?.ttl ?? 60),
          timeout: Number(s.dns?.timeout ?? 8000),
        },
        server: {
          ptrHostname: s.server?.ptrHostname ?? '',
          debugPrefix: s.server?.debugPrefix ?? '',
        },
      })
      setFilterIpsText(ipsToText(s.cache?.filterIps))
      setIgnoreIpsText(ipsToText(s.ignoreIps))
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { data?: { error?: string } } }).response?.data?.error
      setError(typeof msg === 'string' ? msg : t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (isSuperadmin) void load()
    else setLoading(false)
  }, [isSuperadmin, load])

  const patchBody = useMemo(() => {
    return {
      cache: {
        level: form.cache.level,
        expireTime: Number(form.cache.expireTime),
        flushInterval: Number(form.cache.flushInterval),
        filterIps: textToIps(filterIpsText),
      },
      ignoreIps: textToIps(ignoreIpsText),
      dns: {
        ttl: Number(form.dns.ttl),
        timeout: Number(form.dns.timeout),
      },
      server: {
        ptrHostname: form.server.ptrHostname,
        debugPrefix: form.server.debugPrefix,
      },
    }
  }, [form, filterIpsText, ignoreIpsText])

  async function handleSave() {
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      const saved = await patchSystemSettings(patchBody)
      setForm({
        cache: {
          level: saved.cache?.level ?? form.cache.level,
          expireTime: Number(saved.cache?.expireTime ?? form.cache.expireTime),
          flushInterval: Number(saved.cache?.flushInterval ?? form.cache.flushInterval),
          filterIps: Array.isArray(saved.cache?.filterIps) ? saved.cache.filterIps : [],
        },
        ignoreIps: Array.isArray(saved.ignoreIps) ? saved.ignoreIps : [],
        dns: {
          ttl: Number(saved.dns?.ttl ?? form.dns.ttl),
          timeout: Number(saved.dns?.timeout ?? form.dns.timeout),
        },
        server: {
          ptrHostname: saved.server?.ptrHostname ?? form.server.ptrHostname,
          debugPrefix: saved.server?.debugPrefix ?? form.server.debugPrefix,
        },
      })
      setFilterIpsText(ipsToText(saved.cache?.filterIps))
      setIgnoreIpsText(ipsToText(saved.ignoreIps))
      setSuccess(t('systemSettings.saveSuccess'))
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { data?: { error?: string } } }).response?.data?.error
      setError(typeof msg === 'string' ? msg : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  if (!isSuperadmin) {
    return <Navigate to="/" replace />
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('systemSettings.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('systemSettings.subtitle')}</p>
        </div>
        <Button disabled={saving} onClick={() => void handleSave()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t('common.save')}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && (
        <p className="text-sm text-green-600 dark:text-green-400" role="status">
          {success}
        </p>
      )}

      {/* Cache */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('systemSettings.cacheSection')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="cache-level">{t('systemSettings.cacheLevel')}</Label>
            <select
              id="cache-level"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.cache.level}
              disabled={saving}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  cache: { ...f.cache, level: e.target.value },
                }))
              }
            >
              {CACHE_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{t('systemSettings.cacheLevelHelp')}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cache-expire">{t('systemSettings.cacheExpire')}</Label>
            <Input
              id="cache-expire"
              type="number"
              min={0}
              value={form.cache.expireTime}
              disabled={saving}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  cache: { ...f.cache, expireTime: Number(e.target.value) },
                }))
              }
            />
            <p className="text-xs text-muted-foreground">{t('systemSettings.cacheExpireHelp')}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cache-flush">{t('systemSettings.cacheFlush')}</Label>
            <Input
              id="cache-flush"
              type="number"
              min={1000}
              value={form.cache.flushInterval}
              disabled={saving}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  cache: { ...f.cache, flushInterval: Number(e.target.value) },
                }))
              }
            />
            <p className="text-xs text-muted-foreground">{t('systemSettings.cacheFlushHelp')}</p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="filter-ips">{t('systemSettings.filterIps')}</Label>
            <textarea
              id="filter-ips"
              className="flex min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
              value={filterIpsText}
              disabled={saving}
              onChange={(e) => setFilterIpsText(e.target.value)}
              placeholder={'1.2.3.4\n2001:db8::1'}
            />
            <p className="text-xs text-muted-foreground">{t('systemSettings.ipListHelp')}</p>
          </div>
        </CardContent>
      </Card>

      {/* Ignore IPs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('systemSettings.ignoreSection')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="ignore-ips">{t('systemSettings.ignoreIps')}</Label>
          <textarea
            id="ignore-ips"
            className="flex min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
            value={ignoreIpsText}
            disabled={saving}
            onChange={(e) => setIgnoreIpsText(e.target.value)}
            placeholder={'10.0.0.1\n192.168.0.1'}
          />
          <p className="text-xs text-muted-foreground">{t('systemSettings.ignoreIpsHelp')}</p>
        </CardContent>
      </Card>

      {/* DNS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('systemSettings.dnsSection')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="dns-ttl">{t('systemSettings.dnsTtl')}</Label>
            <Input
              id="dns-ttl"
              type="number"
              min={0}
              value={form.dns.ttl}
              disabled={saving}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  dns: { ...f.dns, ttl: Number(e.target.value) },
                }))
              }
            />
            <p className="text-xs text-muted-foreground">{t('systemSettings.dnsTtlHelp')}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dns-timeout">{t('systemSettings.dnsTimeout')}</Label>
            <Input
              id="dns-timeout"
              type="number"
              min={100}
              value={form.dns.timeout}
              disabled={saving}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  dns: { ...f.dns, timeout: Number(e.target.value) },
                }))
              }
            />
            <p className="text-xs text-muted-foreground">{t('systemSettings.dnsTimeoutHelp')}</p>
          </div>
        </CardContent>
      </Card>

      {/* Server */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('systemSettings.serverSection')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ptr">{t('systemSettings.ptrHostname')}</Label>
            <Input
              id="ptr"
              className="font-mono"
              value={form.server.ptrHostname}
              disabled={saving}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  server: { ...f.server, ptrHostname: e.target.value },
                }))
              }
            />
            <p className="text-xs text-muted-foreground">{t('systemSettings.ptrHostnameHelp')}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="debug-prefix">{t('systemSettings.debugPrefix')}</Label>
            <Input
              id="debug-prefix"
              className="font-mono"
              value={form.server.debugPrefix}
              disabled={saving}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  server: { ...f.server, debugPrefix: e.target.value },
                }))
              }
            />
            <p className="text-xs text-muted-foreground">{t('systemSettings.debugPrefixHelp')}</p>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
