import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface StringListEditorProps {
  values: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  /** mono font for IPs/domains */
  mono?: boolean
}

/** Editable list of strings with add / remove (no selected flag). */
export function StringListEditor({
  values,
  onChange,
  placeholder,
  disabled,
  className,
  mono = true,
}: StringListEditorProps) {
  const { t } = useTranslation()

  function setAt(index: number, value: string) {
    const next = [...values]
    next[index] = value
    onChange(next)
  }

  function removeAt(index: number) {
    onChange(values.filter((_, i) => i !== index))
  }

  function add() {
    onChange([...values, ''])
  }

  return (
    <div className={cn('space-y-2', className)}>
      {values.length === 0 && (
        <p className="text-xs text-muted-foreground px-0.5">{t('records.noValuesInGroup')}</p>
      )}
      {values.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            className={cn('h-8 flex-1 text-sm', mono && 'font-mono')}
            value={v}
            disabled={disabled}
            placeholder={placeholder}
            onChange={(e) => setAt(i, e.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
            disabled={disabled}
            onClick={() => removeAt(i)}
            aria-label={t('common.delete')}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={add}>
        <Plus className="h-3.5 w-3.5" />
        {t('records.addEntry')}
      </Button>
    </div>
  )
}
