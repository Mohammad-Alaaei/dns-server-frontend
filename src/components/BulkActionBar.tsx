import { useTranslation } from 'react-i18next'
import { Power, PowerOff, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SelectedRow } from '@/hooks/useRowSelection'

interface BulkActionBarProps {
  selectedRows: SelectedRow[]
  busy?: boolean
  showEnable?: boolean
  showDisable?: boolean
  showDelete?: boolean
  onEnable?: () => void
  onDisable?: () => void
  onDelete?: () => void
  onClear: () => void
}

export function BulkActionBar({
  selectedRows,
  busy,
  showEnable = true,
  showDisable = true,
  showDelete = true,
  onEnable,
  onDisable,
  onDelete,
  onClear,
}: BulkActionBarProps) {
  const { t } = useTranslation()
  if (selectedRows.length === 0) return null

  const preview = selectedRows.slice(0, 5)
  const extra = selectedRows.length - preview.length

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium">
          {t('bulk.selected', { count: selectedRows.length })}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {preview.map((r) => r.label).join(', ')}
          {extra > 0 ? ` +${extra}` : ''}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {showEnable && onEnable && (
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onEnable}>
            <Power className="h-4 w-4" />
            {t('bulk.enable')}
          </Button>
        )}
        {showDisable && onDisable && (
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onDisable}>
            <PowerOff className="h-4 w-4" />
            {t('bulk.disable')}
          </Button>
        )}
        {showDelete && onDelete && (
          <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
            {t('bulk.delete')}
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onClear}>
          <X className="h-4 w-4" />
          {t('bulk.clear')}
        </Button>
      </div>
    </div>
  )
}
