import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Loader2, X } from 'lucide-react'
import {
  createRewriteRule,
  updateRewriteRule,
  type RewriteAction,
  type RewriteRuleItem,
} from '@/api/rewrite-rules'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

const ACTIONS: RewriteAction[] = ['cname_rewrite']

/** Candidate domains used to demonstrate pattern → template when they match. */
const PREVIEW_CANDIDATES = [
  'r3---sn-g5njvh-n8vl.googlevideo.com',
  'r1---sn-vh5ouxa-hjuk.googlevideo.com',
  'rr3---sn-qxau5-btqk.googlevideo.com',
  'foo---bar.example.com',
  'a---b.c.example.net',
  'www.example.com',
  'cdn.media.example.com',
  'sub.domain.example.org',
]

function compilePattern(pattern: string): { regex: RegExp | null; error: string | null } {
  const trimmed = pattern.trim()
  if (!trimmed) {
    return { regex: null, error: 'required' }
  }
  try {
    return { regex: new RegExp(`^(?:${trimmed})$`, 'i'), error: null }
  } catch {
    return { regex: null, error: 'invalid' }
  }
}

function validateTemplate(template: string, action: RewriteAction): string | null {
  if (action !== 'cname_rewrite') return null
  if (!template.trim()) return 'required'
  return null
}

/**
 * Build synthetic sample hostnames from the pattern by filling common group tokens.
 * Used when none of the fixed candidates match.
 */
function synthesizeSamples(pattern: string): string[] {
  let s = pattern
  // Strip non-capturing groups used as structure only (keep content)
  s = s.replace(/\(\?:/g, '(')
  // Fill common quantifiers / classes with concrete pieces
  const fills = ['r3', 'sn-g5njvh-n8vl', 'example', 'com']
  let fillIdx = 0
  const nextFill = () => fills[fillIdx++ % fills.length]

  s = s
    .replace(/\\\./g, '.')
    .replace(/\\\-/g, '-')
    .replace(/\(\.\+\)/g, () => nextFill())
    .replace(/\(\.\*\)/g, () => nextFill())
    .replace(/\(\[^\.\]\+\)/g, () => nextFill())
    .replace(/\(\.\+ \?\)/g, () => nextFill())
    .replace(/\.\+/g, () => nextFill())
    .replace(/\.\*/g, 'x')
    .replace(/\[a-z0-9\.\-_\]\+/gi, () => nextFill())
    .replace(/\[[^\]]+\]\+/g, () => nextFill())
    .replace(/\[[^\]]+\]\*/g, '')
    .replace(/\[[^\]]+\]/g, 'a')
    .replace(/[()^$?|{}]/g, '')

  const sample = s.replace(/\s+/g, '').toLowerCase()
  if (!sample || sample.length < 3 || sample.length > 253) {
    return ['r3---sn-example.googlevideo.com', 'foo---bar.example.com']
  }
  return [sample]
}

function buildPreviews(
  pattern: string,
  template: string
): { before: string; after: string }[] {
  const { regex } = compilePattern(pattern)
  if (!regex || !template.trim()) return []

  const tpl = template.trim()
  const matched: string[] = []
  for (const c of PREVIEW_CANDIDATES) {
    if (regex.test(c) && matched.length < 3) matched.push(c)
  }
  if (matched.length === 0) {
    for (const s of synthesizeSamples(pattern)) {
      if (regex.test(s)) matched.push(s)
    }
  }

  const out: { before: string; after: string }[] = []
  for (const before of matched) {
    try {
      const after = before.replace(regex, tpl).toLowerCase().replace(/\.$/, '')
      if (!after || after === before) continue
      out.push({ before, after })
    } catch {
      // ignore bad replace
    }
  }
  return out.slice(0, 3)
}

interface RewriteRuleFormModalProps {
  open: boolean
  rule?: RewriteRuleItem | null
  onClose: () => void
  onSaved: (rule: RewriteRuleItem) => void
}

export function RewriteRuleFormModal({
  open,
  rule,
  onClose,
  onSaved,
}: RewriteRuleFormModalProps) {
  const { t } = useTranslation()
  const isEdit = rule != null && typeof rule.id === 'number'

  const [name, setName] = useState('')
  const [pattern, setPattern] = useState('')
  const [action, setAction] = useState<RewriteAction>('cname_rewrite')
  const [template, setTemplate] = useState('$1.$2')
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [patternTouched, setPatternTouched] = useState(false)
  const [templateTouched, setTemplateTouched] = useState(false)

  useEffect(() => {
    if (!open) return
    if (rule) {
      setName(rule.name ?? '')
      setPattern(rule.pattern)
      setAction((rule.action as RewriteAction) || 'cname_rewrite')
      const tpl =
        rule.params && typeof rule.params.template === 'string'
          ? rule.params.template
          : '$1.$2'
      setTemplate(tpl)
      setEnabled(!!rule.enabled)
    } else {
      setName('')
      setPattern('')
      setAction('cname_rewrite')
      setTemplate('$1.$2')
      setEnabled(true)
    }
    setError('')
    setSaving(false)
    setPatternTouched(false)
    setTemplateTouched(false)
  }, [open, rule])

  const patternCheck = useMemo(() => compilePattern(pattern), [pattern])
  const templateErrorKey = useMemo(
    () => validateTemplate(template, action),
    [template, action]
  )

  const patternError =
    patternTouched || pattern.length > 0
      ? patternCheck.error === 'required'
        ? t('rewriteRules.patternRequired')
        : patternCheck.error === 'invalid'
          ? t('rewriteRules.patternInvalid')
          : null
      : null

  const templateError =
    action === 'cname_rewrite' && (templateTouched || template.length >= 0)
      ? templateErrorKey === 'required'
        ? t('rewriteRules.templateRequired')
        : null
      : null

  // Show template required only after touch or when empty after interaction
  const showTemplateError =
    action === 'cname_rewrite' &&
    templateError &&
    (templateTouched || template.trim() === '')

  const previews = useMemo(() => {
    if (action !== 'cname_rewrite') return []
    if (patternCheck.error || templateErrorKey) return []
    return buildPreviews(pattern, template)
  }, [action, pattern, template, patternCheck.error, templateErrorKey])

  const formInvalid =
    !!patternCheck.error ||
    (action === 'cname_rewrite' && !!templateErrorKey)

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setPatternTouched(true)
    setTemplateTouched(true)

    if (formInvalid) {
      return
    }

    setSaving(true)
    try {
      const params =
        action === 'cname_rewrite' ? { template: template.trim() } : {}

      let saved: RewriteRuleItem
      if (isEdit && rule) {
        saved = await updateRewriteRule(rule.id, {
          name: name.trim() || null,
          pattern: pattern.trim(),
          action,
          params,
          enabled,
        })
      } else {
        saved = await createRewriteRule({
          name: name.trim() || null,
          pattern: pattern.trim(),
          action,
          params,
          enabled,
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
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => !saving && onClose()}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal
        className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border bg-card p-6 shadow-lg"
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold">
            {isEdit ? t('rewriteRules.editTitle') : t('rewriteRules.createTitle')}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={saving}
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rw-name">{t('rewriteRules.name')}</Label>
            <Input
              id="rw-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
              placeholder={t('rewriteRules.nameOptional')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rw-pattern">{t('rewriteRules.pattern')}</Label>
            <Input
              id="rw-pattern"
              className="font-mono text-sm"
              value={pattern}
              onChange={(e) => {
                setPattern(e.target.value)
                setPatternTouched(true)
              }}
              onBlur={() => setPatternTouched(true)}
              disabled={saving}
              placeholder={String.raw`(.+)---(.+\.googlevideo\.com)`}
              required
              aria-invalid={!!patternError}
            />
            {patternError ? (
              <p className="text-xs text-destructive">{patternError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{t('rewriteRules.patternHelp')}</p>
            )}
          </div>

          {action === 'cname_rewrite' && (
            <div className="space-y-2">
              <Label htmlFor="rw-template">{t('rewriteRules.template')}</Label>
              <Input
                id="rw-template"
                className="font-mono text-sm"
                value={template}
                onChange={(e) => {
                  setTemplate(e.target.value)
                  setTemplateTouched(true)
                }}
                onBlur={() => setTemplateTouched(true)}
                disabled={saving}
                placeholder="$1.$2"
                required
                aria-invalid={!!showTemplateError}
              />
              {showTemplateError ? (
                <p className="text-xs text-destructive">{templateError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">{t('rewriteRules.templateHelp')}</p>
              )}
            </div>
          )}

          {/* Live before → after preview */}
          {action === 'cname_rewrite' && !patternCheck.error && !templateErrorKey && (
            <div className="rounded-md border bg-muted/40 p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {t('rewriteRules.previewTitle')}
              </p>
              {previews.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('rewriteRules.previewEmpty')}</p>
              ) : (
                <ul className="space-y-1.5">
                  {previews.map((p) => (
                    <li
                      key={p.before}
                      className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2 font-mono text-xs"
                    >
                      <span className="text-muted-foreground break-all">{p.before}</span>
                      <ArrowRight className="hidden sm:inline h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="text-foreground break-all font-medium">{p.after}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="rw-action">{t('rewriteRules.action')}</Label>
            <select
              id="rw-action"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={action}
              disabled={saving}
              onChange={(e) => setAction(e.target.value as RewriteAction)}
            >
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {t(`rewriteRules.actions.${a}`, { defaultValue: a })}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={enabled}
              disabled={saving}
              onCheckedChange={setEnabled}
            />
            <Label>{enabled ? t('common.enabled') : t('common.disabled')}</Label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={saving || formInvalid}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
