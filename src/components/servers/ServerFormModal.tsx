import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, X } from 'lucide-react'
import {
  createDnsServer,
  updateDnsServer,
  type DnsServerDetail,
  type DnsServerListItem,
  type DnsServerType,
} from '@/api/dns-servers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

interface ServerFormModalProps {
  open: boolean
  server?: DnsServerListItem | DnsServerDetail | null
  lockAsLastDefault?: boolean
  onClose: () => void
  onSaved: (server: DnsServerDetail) => void
}

export function ServerFormModal({
  open,
  server,
  lockAsLastDefault = false,
  onClose,
  onSaved,
}: ServerFormModalProps) {
  const { t } = useTranslation()
  const isEdit = server != null && typeof server.id === 'number'

  const [ip, setIp] = useState('')
  const [type, setType] = useState<DnsServerType>('CUSTOM')
  const [enabled, setEnabled] = useState(true)
  const [priority, setPriority] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    if (server) {
      setIp(server.ip)
      setType((server.type as DnsServerType) || 'CUSTOM')
      setEnabled(!!server.enabled)
      setPriority(server.priority != null ? String(server.priority) : '')
    } else {
      setIp('')
      setType('CUSTOM')
      setEnabled(true)
      setPriority('')
    }
    setError('')
    setSaving(false)
  }, [open, server])

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!ip.trim()) {
      setError(t('servers.ipRequired'))
      return
    }
    if (lockAsLastDefault && (type !== 'DEFAULT' || !enabled)) {
      setError(t('servers.lastDefaultGuard'))
      return
    }

    setSaving(true)
    try {
      const priorityNum = priority.trim() === '' ? undefined : Number(priority)
      if (priority.trim() !== '' && !Number.isFinite(priorityNum)) {
        setError(t('servers.priorityInvalid'))
        setSaving(false)
        return
      }

      let saved: DnsServerDetail
      if (isEdit && server) {
        saved = await updateDnsServer(server.id, {
          ip: ip.trim(),
          type,
          enabled,
          priority: priorityNum !== undefined ? priorityNum : 0,
        })
      } else {
        saved = await createDnsServer({
          ip: ip.trim(),
          type,
          enabled,
          ...(priorityNum !== undefined ? { priority: priorityNum } : {}),
        })
      }
      onSaved(saved)
      onClose()
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

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={() => !saving && onClose()} aria-hidden />
      <div role="dialog" aria-modal className="relative z-10 w-full max-w-md rounded-xl border bg-card p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold">
            {isEdit ? t('servers.editTitle') : t('servers.createTitle')}
          </h2>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={saving} onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="srv-ip">{t('servers.ip')}</Label>
            <Input id="srv-ip" className="font-mono" value={ip} onChange={(e) => setIp(e.target.value)} disabled={saving} placeholder="8.8.8.8" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="srv-type">{t('servers.type')}</Label>
            <select
              id="srv-type"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={type}
              disabled={saving || lockAsLastDefault}
              onChange={(e) => setType(e.target.value as DnsServerType)}
            >
              <option value="CUSTOM">CUSTOM</option>
              <option value="DEFAULT">DEFAULT</option>
            </select>
            {lockAsLastDefault && (
              <p className="text-xs text-muted-foreground">{t('servers.lastDefaultHint')}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={enabled}
              disabled={saving || (lockAsLastDefault && enabled)}
              onCheckedChange={(v) => {
                if (lockAsLastDefault && !v) {
                  setError(t('servers.lastDefaultGuard'))
                  return
                }
                setEnabled(v)
              }}
            />
            <Label>{enabled ? t('common.enabled') : t('common.disabled')}</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="srv-pri">{t('servers.priority')}</Label>
            <Input id="srv-pri" type="number" value={priority} onChange={(e) => setPriority(e.target.value)} disabled={saving} placeholder={t('servers.priorityOptional')} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
