import { useCallback, useEffect, useState } from 'react'
import type { ListToolbarSubmit } from '@/lib/listQuery'
import type { SortState } from '@/components/SortableHeader'

export interface PersistedListState {
  page: number
  toolbarQuery: ListToolbarSubmit
  sortState: SortState
}

function readStorage(key: string): PersistedListState | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersistedListState>
    if (!parsed || typeof parsed !== 'object') return null
    return {
      page: typeof parsed.page === 'number' && parsed.page >= 1 ? parsed.page : 1,
      toolbarQuery: parsed.toolbarQuery ?? {
        search: '',
        searchField: '',
        filters: [],
        filterLogic: 'AND',
      },
      sortState: parsed.sortState ?? { sortBy: null, sortDir: null },
    }
  } catch {
    return null
  }
}

/**
 * Persist list page / search / filters / sort in sessionStorage so navigating
 * to a detail page and back restores the same list state.
 */
export function usePersistedListState(
  storageKey: string,
  defaults: PersistedListState
): {
  page: number
  setPage: (p: number | ((prev: number) => number)) => void
  toolbarQuery: ListToolbarSubmit
  setToolbarQuery: (q: ListToolbarSubmit) => void
  sortState: SortState
  setSortState: (s: SortState | ((prev: SortState) => SortState)) => void
} {
  const key = `dns_list:${storageKey}`

  const [page, setPageState] = useState(() => readStorage(key)?.page ?? defaults.page)
  const [toolbarQuery, setToolbarQueryState] = useState<ListToolbarSubmit>(
    () => readStorage(key)?.toolbarQuery ?? defaults.toolbarQuery
  )
  const [sortState, setSortStateState] = useState<SortState>(
    () => readStorage(key)?.sortState ?? defaults.sortState
  )

  useEffect(() => {
    try {
      const payload: PersistedListState = { page, toolbarQuery, sortState }
      sessionStorage.setItem(key, JSON.stringify(payload))
    } catch {
      /* ignore quota */
    }
  }, [key, page, toolbarQuery, sortState])

  const setPage = useCallback((p: number | ((prev: number) => number)) => {
    setPageState(p)
  }, [])

  const setToolbarQuery = useCallback((q: ListToolbarSubmit) => {
    setToolbarQueryState(q)
    setPageState(1)
  }, [])

  const setSortState = useCallback((s: SortState | ((prev: SortState) => SortState)) => {
    setSortStateState(s)
    setPageState(1)
  }, [])

  return {
    page,
    setPage,
    toolbarQuery,
    setToolbarQuery,
    sortState,
    setSortState,
  }
}
