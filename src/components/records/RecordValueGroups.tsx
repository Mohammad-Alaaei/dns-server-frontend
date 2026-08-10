import { useTranslation } from 'react-i18next'
import { Globe2, Link2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { StringListEditor } from './StringListEditor'

export type RecordValueMode = 'address' | 'cname'

export interface CnameTargetDraft {
  key: string
  domain: string
  a: string[]
  aaaa: string[]
  /** Child record id when loaded from cnameChain */
  recordId?: number
}

/** Address values scoped to one upstream (or null = local / manual). */
export interface AddressGroup {
  key: string
  dns_server_id: number | null
  a: string[]
  aaaa: string[]
}

export interface RecordValuesState {
  mode: RecordValueMode
  /** Preserved when switching to CNAME tab */
  addressGroups: AddressGroup[]
  /** Preserved when switching to address tab */
  cnames: CnameTargetDraft[]
}

export interface ServerOption {
  id: number
  label: string
}

interface RecordValueGroupsProps {
  state: RecordValuesState
  disabled?: boolean
  /** Create: no server picker. Edit: show picker per address group. */
  isEdit?: boolean
  servers?: ServerOption[]
  onChange: (next: RecordValuesState) => void
}

function newKey(prefix = 'k') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

export function emptyValuesState(): RecordValuesState {
  return {
    mode: 'address',
    addressGroups: [{ key: newKey('ag'), dns_server_id: null, a: [], aaaa: [] }],
    cnames: [],
  }
}

function hasAddressData(state: RecordValuesState): boolean {
  return state.addressGroups.some(
    (g) => g.a.some((x) => x.trim()) || g.aaaa.some((x) => x.trim())
  )
}

function hasCnameData(state: RecordValuesState): boolean {
  return state.cnames.some(
    (c) => c.domain.trim() || c.a.some((x) => x.trim()) || c.aaaa.some((x) => x.trim())
  )
}

/**
 * Tab lock rules:
 * - If only address data → CNAME tab disabled
 * - If only CNAME data → address tab disabled
 * - If both or neither → both enabled
 * - Empty CNAME list after removing all → address becomes available (and vice versa)
 */
export function tabLocks(state: RecordValuesState): {
  addressDisabled: boolean
  cnameDisabled: boolean
} {
  const addr = hasAddressData(state)
  const cname = hasCnameData(state)
  if (addr && !cname) return { addressDisabled: false, cnameDisabled: true }
  if (cname && !addr) return { addressDisabled: true, cnameDisabled: false }
  return { addressDisabled: false, cnameDisabled: false }
}

/** Build API values[] for the primary domain (create / local). */
export function buildPrimaryValues(state: RecordValuesState) {
  if (state.mode === 'address') {
    // Merge all groups for create (usually one null group); include dns_server_id when set
    const values: { type: string; value: string[]; dns_server_id?: number | null }[] = []
    for (const g of state.addressGroups) {
      const a = g.a.map((s) => s.trim()).filter(Boolean)
      const aaaa = g.aaaa.map((s) => s.trim()).filter(Boolean)
      if (a.length) {
        values.push({
          type: 'A',
          value: a,
          ...(g.dns_server_id != null ? { dns_server_id: g.dns_server_id } : {}),
        })
      }
      if (aaaa.length) {
        values.push({
          type: 'AAAA',
          value: aaaa,
          ...(g.dns_server_id != null ? { dns_server_id: g.dns_server_id } : {}),
        })
      }
    }
    return values
  }
  const cnames = state.cnames.map((c) => c.domain.trim().replace(/\.$/, '')).filter(Boolean)
  if (!cnames.length) return []
  return [{ type: 'CNAME', value: cnames }]
}

export function RecordValueGroups({
  state,
  disabled,
  isEdit = false,
  servers = [],
  onChange,
}: RecordValueGroupsProps) {
  const { t } = useTranslation()
  const locks = tabLocks(state)
  const mixed = hasAddressData(state) && hasCnameData(state)

  function setMode(mode: RecordValueMode) {
    if (mode === state.mode) return
    if (mode === 'address' && locks.addressDisabled) return
    if (mode === 'cname' && locks.cnameDisabled) return
    // Keep both addressGroups and cnames — never wipe the other side
    onChange({ ...state, mode })
  }

  return (
    <div className="space-y-4">
      {/* High-visibility mode switch */}
      <div
        className="grid grid-cols-2 gap-2 rounded-xl border-2 border-border bg-muted/30 p-1.5"
        role="tablist"
        aria-label={t('records.valueMode')}
      >
        <button
          type="button"
          role="tab"
          aria-selected={state.mode === 'address'}
          disabled={disabled || locks.addressDisabled}
          className={cn(
            'flex items-center justify-center gap-2 rounded-lg px-3 py-3.5 text-sm font-semibold transition-all',
            state.mode === 'address'
              ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/40'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/60',
            (disabled || locks.addressDisabled) && 'opacity-40 cursor-not-allowed hover:bg-transparent'
          )}
          onClick={() => setMode('address')}
        >
          <Globe2 className="h-4 w-4 shrink-0" />
          <span className="text-start">
            <span className="block">{t('records.modeAddress')}</span>
            <span
              className={cn(
                'block text-[11px] font-normal',
                state.mode === 'address' ? 'text-primary-foreground/80' : 'opacity-70'
              )}
            >
              A / AAAA
            </span>
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={state.mode === 'cname'}
          disabled={disabled || locks.cnameDisabled}
          className={cn(
            'flex items-center justify-center gap-2 rounded-lg px-3 py-3.5 text-sm font-semibold transition-all',
            state.mode === 'cname'
              ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/40'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/60',
            (disabled || locks.cnameDisabled) && 'opacity-40 cursor-not-allowed hover:bg-transparent'
          )}
          onClick={() => setMode('cname')}
        >
          <Link2 className="h-4 w-4 shrink-0" />
          <span className="text-start">
            <span className="block">{t('records.modeCname')}</span>
            <span
              className={cn(
                'block text-[11px] font-normal',
                state.mode === 'cname' ? 'text-primary-foreground/80' : 'opacity-70'
              )}
            >
              CNAME → A/AAAA
            </span>
          </span>
        </button>
      </div>

      {mixed && (
        <div
          role="alert"
          className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100"
        >
          {t('records.mixedWarning')}
        </div>
      )}
      {locks.addressDisabled && state.mode === 'cname' && (
        <p className="text-xs text-muted-foreground">{t('records.tabLockedAddress')}</p>
      )}
      {locks.cnameDisabled && state.mode === 'address' && (
        <p className="text-xs text-muted-foreground">{t('records.tabLockedCname')}</p>
      )}

      {state.mode === 'address' ? (
        <div className="space-y-3">
          {state.addressGroups.map((g, gi) => (
            <Card key={g.key}>
              <CardHeader className="py-3 px-4 flex flex-row flex-wrap items-center gap-3 space-y-0">
                <CardTitle className="text-sm font-medium">
                  {t('records.addressGroup', { n: gi + 1 })}
                </CardTitle>
                {isEdit && (
                  <select
                    className="h-8 min-w-[10rem] flex-1 rounded-md border border-input bg-background text-foreground px-2 text-xs"
                    value={g.dns_server_id ?? ''}
                    disabled={disabled}
                    onChange={(e) => {
                      const raw = e.target.value
                      const dns_server_id = raw === '' ? null : Number(raw)
                      onChange({
                        ...state,
                        addressGroups: state.addressGroups.map((x) =>
                          x.key === g.key ? { ...x, dns_server_id } : x
                        ),
                      })
                    }}
                  >
                    <option value="">{t('records.localServer')}</option>
                    {servers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                )}
                {isEdit && state.addressGroups.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    disabled={disabled}
                    onClick={() =>
                      onChange({
                        ...state,
                        addressGroups: state.addressGroups.filter((x) => x.key !== g.key),
                      })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="px-4 pb-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-medium flex items-center gap-2">
                    <span className="font-mono">A</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {g.a.filter(Boolean).length}
                    </Badge>
                  </p>
                  <StringListEditor
                    values={g.a}
                    onChange={(a) =>
                      onChange({
                        ...state,
                        addressGroups: state.addressGroups.map((x) =>
                          x.key === g.key ? { ...x, a } : x
                        ),
                      })
                    }
                    placeholder={t('records.valuePlaceholderA')}
                    disabled={disabled}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium flex items-center gap-2">
                    <span className="font-mono">AAAA</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {g.aaaa.filter(Boolean).length}
                    </Badge>
                  </p>
                  <StringListEditor
                    values={g.aaaa}
                    onChange={(aaaa) =>
                      onChange({
                        ...state,
                        addressGroups: state.addressGroups.map((x) =>
                          x.key === g.key ? { ...x, aaaa } : x
                        ),
                      })
                    }
                    placeholder={t('records.valuePlaceholderAaaa')}
                    disabled={disabled}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
          {isEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() =>
                onChange({
                  ...state,
                  addressGroups: [
                    ...state.addressGroups,
                    { key: newKey('ag'), dns_server_id: null, a: [], aaaa: [] },
                  ],
                })
              }
            >
              <Plus className="h-3.5 w-3.5" />
              {t('records.addAddressGroup')}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{t('records.cnameModeHint')}</p>
          {state.cnames.length === 0 && (
            <p className="text-sm text-muted-foreground border rounded-lg px-4 py-6 text-center">
              {t('records.noCnameTargets')}
            </p>
          )}
          {state.cnames.map((c, index) => (
            <Card key={c.key} className="overflow-hidden">
              <CardHeader className="py-3 px-4 flex flex-row items-center gap-3 space-y-0">
                <CardTitle className="text-sm font-medium shrink-0">
                  CNAME {index + 1}
                </CardTitle>
                <Input
                  className="h-8 font-mono text-sm flex-1"
                  value={c.domain}
                  disabled={disabled}
                  placeholder={t('records.valuePlaceholderCname')}
                  onChange={(e) => {
                    onChange({
                      ...state,
                      cnames: state.cnames.map((x) =>
                        x.key === c.key ? { ...x, domain: e.target.value } : x
                      ),
                    })
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                  disabled={disabled}
                  onClick={() =>
                    onChange({
                      ...state,
                      cnames: state.cnames.filter((x) => x.key !== c.key),
                    })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardHeader>
              <CardContent className="px-4 pb-4 grid gap-4 md:grid-cols-2 border-t pt-4">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground font-mono">A</p>
                  <StringListEditor
                    values={c.a}
                    onChange={(a) =>
                      onChange({
                        ...state,
                        cnames: state.cnames.map((x) =>
                          x.key === c.key ? { ...x, a } : x
                        ),
                      })
                    }
                    placeholder={t('records.valuePlaceholderA')}
                    disabled={disabled}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground font-mono">AAAA</p>
                  <StringListEditor
                    values={c.aaaa}
                    onChange={(aaaa) =>
                      onChange({
                        ...state,
                        cnames: state.cnames.map((x) =>
                          x.key === c.key ? { ...x, aaaa } : x
                        ),
                      })
                    }
                    placeholder={t('records.valuePlaceholderAaaa')}
                    disabled={disabled}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() =>
              onChange({
                ...state,
                cnames: [
                  ...state.cnames,
                  { key: newKey('c'), domain: '', a: [], aaaa: [] },
                ],
              })
            }
          >
            <Plus className="h-3.5 w-3.5" />
            {t('records.addCnameTarget')}
          </Button>
        </div>
      )}
    </div>
  )
}
