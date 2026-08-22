import { useCallback, useMemo, useState } from 'react'

export type SelectedRow = { id: number; label: string }

/**
 * Cross-page row selection kept in component state (cleared on full page refresh).
 */
export function useRowSelection() {
  const [selected, setSelected] = useState<Map<number, string>>(() => new Map())

  const selectedIds = useMemo(() => [...selected.keys()], [selected])
  const selectedRows = useMemo(
    () => selectedIds.map((id) => ({ id, label: selected.get(id) ?? String(id) })),
    [selected, selectedIds]
  )
  const count = selected.size

  const isSelected = useCallback((id: number) => selected.has(id), [selected])

  const toggle = useCallback((id: number, label: string) => {
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(id)) next.delete(id)
      else next.set(id, label)
      return next
    })
  }, [])

  const setMany = useCallback((rows: SelectedRow[], on: boolean) => {
    setSelected((prev) => {
      const next = new Map(prev)
      for (const row of rows) {
        if (on) next.set(row.id, row.label)
        else next.delete(row.id)
      }
      return next
    })
  }, [])

  const clear = useCallback(() => setSelected(new Map()), [])

  /** Header checkbox state for the current page of items. */
  function pageCheckState(pageIds: number[]): 'none' | 'some' | 'all' {
    if (pageIds.length === 0) return 'none'
    const n = pageIds.filter((id) => selected.has(id)).length
    if (n === 0) return 'none'
    if (n === pageIds.length) return 'all'
    return 'some'
  }

  function togglePage(rows: SelectedRow[]) {
    const state = pageCheckState(rows.map((r) => r.id))
    setMany(rows, state !== 'all')
  }

  return {
    selected,
    selectedIds,
    selectedRows,
    count,
    isSelected,
    toggle,
    setMany,
    clear,
    pageCheckState,
    togglePage,
  }
}
