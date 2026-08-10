import { useTranslation } from 'react-i18next'
import { Trash2, Save, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { RecordValueType } from '@/api/records'

export interface EditableValueRow {
  key: string
  id?: number
  type: RecordValueType
  value: string
  selected: boolean
  /** Local dirty flag (edit mode) */
  dirty?: boolean
  saving?: boolean
}

interface RecordValueRowProps {
  row: EditableValueRow
  /** create = local only; edit = can save/delete against API */
  mode: 'create' | 'edit'
  disabled?: boolean
  onChange: (key: string, patch: Partial<EditableValueRow>) => void
  onRemove: (key: string) => void
  onSave?: (key: string) => void
}

export function RecordValueRow({
  row,
  mode,
  disabled,
  onChange,
  onRemove,
  onSave,
}: RecordValueRowProps) {
  const { t } = useTranslation()
  const placeholder =
    row.type === 'CNAME'
      ? t('records.valuePlaceholderCname')
      : row.type === 'AAAA'
        ? t('records.valuePlaceholderAaaa')
        : t('records.valuePlaceholderA')

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b last:border-0">
      <Input
        className="flex-1 min-w-[10rem] h-8 text-sm font-mono"
        value={row.value}
        disabled={disabled || row.saving}
        placeholder={placeholder}
        onChange={(e) => onChange(row.key, { value: e.target.value, dirty: true })}
      />
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer shrink-0">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-input accent-primary"
          checked={row.selected}
          disabled={disabled || row.saving}
          onChange={(e) => onChange(row.key, { selected: e.target.checked, dirty: true })}
        />
        {t('records.selected')}
      </label>
      {mode === 'edit' && row.id != null && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={disabled || row.saving || !row.dirty}
          onClick={() => onSave?.(row.key)}
        >
          {row.saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {t('common.save')}
        </Button>
      )}
      {mode === 'edit' && row.id == null && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={disabled || row.saving || !row.value.trim()}
          onClick={() => onSave?.(row.key)}
        >
          {row.saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {t('common.create')}
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn('h-8 w-8 shrink-0 text-destructive hover:text-destructive')}
        disabled={disabled || row.saving}
        onClick={() => onRemove(row.key)}
        aria-label={t('common.delete')}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
