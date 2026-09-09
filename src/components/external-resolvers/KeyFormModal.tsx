import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, X } from 'lucide-react'
import {
  createExternalResolverKey,
  updateExternalResolverKey,
  type ExternalResolverKey,
} from '@/api/external-resolvers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface KeyFormModalProps {
  open: boolean
  resolverId: number
  edit: ExternalResolverKey | null
  onClose: () => void
  onSaved: () => void
}

export function KeyFormModal({ open, resolverId, edit, onClose, onSaved }: KeyFormModalProps) {
  const { t } = useTranslation()
  const [apiKey, setApiKey] = useState('')
  const [label, setLabel] = useState('')
  const [priority, setPriority] = useState(0)
  const [periodLimit, setPeriodLimit] = useState(0)
  const [periodMs, setPeriodMs] = useState(86400000)
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setSaving(false)
    if (edit) {
      setApiKey(edit.api_key)
      setLabel(edit.label ?? '')
      setPriority(edit.priority)
      setPeriodLimit(edit.period_limit)
      setPeriodMs(edit.period_ms)
      setEnabled(!!edit.enabled)
    } else {
      setApiKey('')
      setLabel('')
      setPriority(0)
      setPeriodLimit(0)
      setPeriodMs(86400000)
      setEnabled(true)
    }
  }, [open, edit])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const key = apiKey.trim()
    if (!key) {
      setError(t('externalResolvers.apiKeyRequired'))
      return
    }
    setSaving(true)
    try {
      if (edit) {
        await updateExternalResolverKey(resolverId, edit.id, {
          api_key: key,
          label: label.trim() || null,
          priority: Number(priority) || 0,
          period_limit: Math.max(0, Math.floor(Number(periodLimit) || 0)),
          period_ms: Math.max(60000, Math.floor(Number(periodMs) || 86400000)),
          enabled,
        })
      } else {
        await createExternalResolverKey(resolverId, {
          api_key: key,
          label: label.trim() || null,
          priority: Number(priority) || 0,
          period_limit: Math.max(0, Math.floor(Number(periodLimit) || 0)),
          period_ms: Math.max(60000, Math.floor(Number(periodMs) || 86400000)),
          enabled,
        })
      }
      onSaved()
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
      <div
        role="dialog"
        aria-modal
        className="relative z-10 w-full max-w-md rounded-xl border bg-card shadow-lg"
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-semibold">
            {edit ? t('externalResolvers.editKeyTitle') : t('externalResolvers.addKeyTitle')}
          </h2>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} disabled={saving}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 px-5 py-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor="ek-key">{t('externalResolvers.apiKey')}</Label>
            <Input
              id="ek-key"
              type="password"
              autoComplete="off"
              className="font-mono"
              value={apiKey}
              disabled={saving}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ek-label">{t('externalResolvers.keyLabel')}</Label>
            <Input
              id="ek-label"
              value={label}
              disabled={saving}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('externalResolvers.keyLabelOptional')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ek-priority">{t('externalResolvers.priority')}</Label>
              <Input
                id="ek-priority"
                type="number"
                min={0}
                value={priority}
                disabled={saving}
                onChange={(e) => setPriority(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">{t('externalResolvers.priorityHelp')}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ek-limit">{t('externalResolvers.periodLimit')}</Label>
              <Input
                id="ek-limit"
                type="number"
                min={0}
                value={periodLimit}
                disabled={saving}
                onChange={(e) => setPeriodLimit(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">{t('externalResolvers.periodLimitHelp')}</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ek-period">{t('externalResolvers.periodMs')}</Label>
            <Input
              id="ek-period"
              type="number"
              min={60000}
              step={60000}
              value={periodMs}
              disabled={saving}
              onChange={(e) => setPeriodMs(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">{t('externalResolvers.periodMsHelp')}</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              disabled={saving}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            {t('common.enabled')}
          </label>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('common.save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
