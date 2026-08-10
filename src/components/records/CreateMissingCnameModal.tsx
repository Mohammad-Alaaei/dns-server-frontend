import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, X } from 'lucide-react'
import { createRecord } from '@/api/records'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { StringListEditor } from '@/components/records/StringListEditor'

interface CreateMissingCnameModalProps {
  open: boolean
  domain: string
  onClose: () => void
  onCreated: () => void
}

/**
 * Modal to create a missing CNAME target host with A / AAAA lists
 * (same UX as CNAME tab nested fields on the record form).
 */
export function CreateMissingCnameModal({
  open,
  domain,
  onClose,
  onCreated,
}: CreateMissingCnameModalProps) {
  const { t } = useTranslation()
  const [a, setA] = useState<string[]>([])
  const [aaaa, setAaaa] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setA([])
      setAaaa([])
      setError('')
      setSaving(false)
    }
  }, [open, domain])

  if (!open) return null

  async function handleCreate() {
    setError('')
    const aVals = a.map((s) => s.trim()).filter(Boolean)
    const aaaaVals = aaaa.map((s) => s.trim()).filter(Boolean)
    if (!aVals.length && !aaaaVals.length) {
      setError(t('records.missingCnameNeedValues'))
      return
    }

    setSaving(true)
    try {
      const values: { type: string; value: string[] }[] = []
      if (aVals.length) values.push({ type: 'A', value: aVals })
      if (aaaaVals.length) values.push({ type: 'AAAA', value: aaaaVals })
      await createRecord({
        domain: domain.replace(/\.$/, ''),
        enabled: true,
        values,
      })
      onCreated()
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
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => !saving && onClose()}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="missing-cname-title"
        className="relative z-10 w-full max-w-lg rounded-xl border bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 id="missing-cname-title" className="text-lg font-semibold">
              {t('records.createMissingCnameTitle')}
            </h2>
            <p className="text-sm text-muted-foreground mt-1 font-mono break-all">{domain}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={saving}
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mb-4">{t('records.createMissingCnameHint')}</p>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="font-mono text-xs">A</Label>
            <StringListEditor
              values={a}
              onChange={setA}
              placeholder={t('records.valuePlaceholderA')}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-xs">AAAA</Label>
            <StringListEditor
              values={aaaa}
              onChange={setAaaa}
              placeholder={t('records.valuePlaceholderAaaa')}
              disabled={saving}
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive mt-3">{error}</p>}

        <div className="flex justify-end gap-2 pt-4 mt-2 border-t">
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="button" disabled={saving} onClick={() => void handleCreate()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('common.create')}
          </Button>
        </div>
      </div>
    </div>
  )
}
