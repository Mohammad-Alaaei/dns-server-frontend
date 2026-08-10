import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, X } from 'lucide-react'
import { createDnsServerRule, updateDnsRule, type DnsRuleItem } from '@/api/dns-servers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface RuleFormModalProps {
  open: boolean
  serverId: number
  rule?: DnsRuleItem | null
  onClose: () => void
  onSaved: () => void
}

export function RuleFormModal({ open, serverId, rule, onClose, onSaved }: RuleFormModalProps) {
  const { t } = useTranslation()
  const isEdit = rule != null && typeof rule.id === 'number'
  const [domain, setDomain] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setDomain(rule?.domain ?? '')
    setError('')
    setSaving(false)
  }, [open, rule])

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!domain.trim()) {
      setError(t('servers.ruleDomainRequired'))
      return
    }
    setSaving(true)
    try {
      if (isEdit && rule) await updateDnsRule(rule.id, domain.trim())
      else await createDnsServerRule(serverId, domain.trim())
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
      <div role="dialog" aria-modal className="relative z-10 w-full max-w-md rounded-xl border bg-card p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold">
            {isEdit ? t('servers.editRuleTitle') : t('servers.addRuleTitle')}
          </h2>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={saving} onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rule-domain">{t('servers.ruleDomain')}</Label>
            <Input
              id="rule-domain"
              className="font-mono"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              disabled={saving}
              placeholder="example.com or ^.*\\.example\\.com$"
              required
            />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{t('servers.ruleDomainHelp')}</p>
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
