import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SortDir = 'ASC' | 'DESC'

export interface SortState {
  sortBy: string | null
  sortDir: SortDir | null
}

interface SortableHeaderProps {
  column: string
  label: string
  sortBy: string | null
  sortDir: SortDir | null
  onSort: (column: string) => void
  className?: string
  align?: 'start' | 'end'
}

/**
 * Header cell with 3-step sort cycle for one column:
 * default → ASC → DESC → default
 */
export function SortableHeader({
  column,
  label,
  sortBy,
  sortDir,
  onSort,
  className,
  align = 'start',
}: SortableHeaderProps) {
  const active = sortBy === column && sortDir != null

  return (
    <th
      className={cn(
        'px-4 py-3 font-medium',
        align === 'end' ? 'text-end' : 'text-start',
        className
      )}
    >
      <button
        type="button"
        className={cn(
          'inline-flex items-center gap-1 cursor-pointer select-none rounded-sm',
          'text-muted-foreground hover:text-foreground transition-colors',
          active && 'text-foreground'
        )}
        onClick={() => onSort(column)}
      >
        <span>{label}</span>
        {active && sortDir === 'ASC' ? (
          <ArrowUp className="h-3.5 w-3.5 shrink-0" />
        ) : active && sortDir === 'DESC' ? (
          <ArrowDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" />
        )}
      </button>
    </th>
  )
}

/** Cycle: off → ASC → DESC → off */
export function nextSortState(
  current: SortState,
  column: string
): SortState {
  if (current.sortBy !== column || current.sortDir == null) {
    return { sortBy: column, sortDir: 'ASC' }
  }
  if (current.sortDir === 'ASC') {
    return { sortBy: column, sortDir: 'DESC' }
  }
  return { sortBy: null, sortDir: null }
}
