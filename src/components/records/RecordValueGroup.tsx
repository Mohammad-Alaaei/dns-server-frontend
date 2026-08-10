import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { RecordValueRow, type EditableValueRow } from './RecordValueRow'
import type { RecordValueType } from '@/api/records'

interface RecordValueGroupProps {
  type: RecordValueType
  rows: EditableValueRow[]
  mode: 'create' | 'edit'
  disabled?: boolean
  defaultOpen?: boolean
  onChange: (key: string, patch: Partial<EditableValueRow>) => void
  onRemove: (key: string) => void
  onAdd: (type: RecordValueType) => void
  onSave?: (key: string) => void
}

export function RecordValueGroup({
  type,
  rows,
  mode,
  disabled,
  defaultOpen = true,
  onChange,
  onRemove,
  onAdd,
  onSave,
}: RecordValueGroupProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(defaultOpen)
  const ofType = rows.filter((r) => r.type === type)

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 cursor-pointer text-start"
          onClick={() => setOpen((o) => !o)}
        >
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <span className="font-mono">{type}</span>
            <Badge variant="secondary" className="text-[10px] tabular-nums">
              {ofType.length}
            </Badge>
          </CardTitle>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              open && 'rotate-180'
            )}
          />
        </button>
      </CardHeader>
      {open && (
        <CardContent className="px-0 pb-3 pt-0">
          {ofType.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">{t('records.noValuesInGroup')}</p>
          ) : (
            <div className="border-t">
              {ofType.map((row) => (
                <RecordValueRow
                  key={row.key}
                  row={row}
                  mode={mode}
                  disabled={disabled}
                  onChange={onChange}
                  onRemove={onRemove}
                  onSave={onSave}
                />
              ))}
            </div>
          )}
          <div className="px-4 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => onAdd(type)}
            >
              <Plus className="h-3.5 w-3.5" />
              {t('records.addValue', { type })}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
