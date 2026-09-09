import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, X } from 'lucide-react'
import {
  createExternalResolver,
  updateExternalResolver,
  type ExternalResolver,
  type ExternalResolverMode,
  type ExternalResolverProvider,
} from '@/api/external-resolvers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const PROVIDERS: ExternalResolverProvider[] = ['mxtoolbox']
const MODES: ExternalResolverMode[] = [
  'manual_only',
  'filtered_only',
  'timeout',
  'all',
]

export interface ResolverFormModalProps {
  open: boolean
  edit: ExternalResolver | null
  onClose: () => void
  onSaved: () => void
}

export function ResolverFormModal({ open, edit, onClose, onSaved }: ResolverFormModalProps) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [provider, setProvider] = useState<ExternalResolverProvider>('mxtoolbox')
  const [mode, setMode] = useState<ExternalResolverMode>('manual_only')
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setSaving(false)
    if (edit) {
      setName(edit.name)
      setProvider(edit.provider)
      setMode(edit.mode)
      setEnabled(!!edit.enabled)
    } else {
      setName('')
      setProvider('mxtoolbox')
      setMode('manual_only')
      setEnabled(true)
    }
  }, [open, edit])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const trimmed = name.trim()
    if (!trimmed) {
      setError(t('externalResolvers.nameRequired'))
      return
    }
    setSaving(true)
    try {
      if (edit) {
        await updateExternalResolver(edit.id, {
          name: trimmed,
          mode,
          enabled,
        })
      } else {
        await createExternalResolver({
          provider,
          name: trimmed,
          mode,
          enabled,
          config: {},
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
            {edit ? t('externalResolvers.editTitle') : t('externalResolvers.createTitle')}
          </h2>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} disabled={saving}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 px-5 py-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor="er-name">{t('externalResolvers.name')}</Label>
            <Input
              id="er-name"
              value={name}
              disabled={saving}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('externalResolvers.namePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="er-provider">{t('externalResolvers.provider')}</Label>
            <select
              id="er-provider"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={provider}
              disabled={saving || !!edit}
              onChange={(e) => setProvider(e.target.value)}
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {t(`externalResolvers.providers.${p}`, { defaultValue: p })}
                </option>
              ))}
            </select>
            {edit && (
              <p className="text-xs text-muted-foreground">{t('externalResolvers.providerImmutable')}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="er-mode">{t('externalResolvers.mode')}</Label>
            <select
              id="er-mode"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={mode}
              disabled={saving}
              onChange={(e) => setMode(e.target.value)}
            >
              {MODES.map((m) => (
                <option key={m} value={m}>
                  {t(`externalResolvers.modes.${m}`, { defaultValue: m })}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{t('externalResolvers.modeHelp')}</p>
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
