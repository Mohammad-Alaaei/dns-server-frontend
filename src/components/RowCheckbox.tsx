import { cn } from '@/lib/utils'

interface RowCheckboxProps {
  checked: boolean
  indeterminate?: boolean
  disabled?: boolean
  onChange: () => void
  'aria-label'?: string
}

/** Stop row-click navigation when toggling selection. */
export function RowCheckbox({
  checked,
  indeterminate,
  disabled,
  onChange,
  'aria-label': ariaLabel,
}: RowCheckboxProps) {
  return (
    <input
      type="checkbox"
      className={cn(
        'h-4 w-4 shrink-0 cursor-pointer accent-primary rounded border-input',
        disabled && 'cursor-not-allowed opacity-50'
      )}
      checked={checked}
      disabled={disabled}
      ref={(el) => {
        if (el) el.indeterminate = !!indeterminate && !checked
      }}
      aria-label={ariaLabel}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) => {
        e.stopPropagation()
        onChange()
      }}
    />
  )
}
