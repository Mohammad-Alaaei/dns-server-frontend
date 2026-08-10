import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  Search,
  X,
  Filter,
  Plus,
  Trash2,
  RotateCcw,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type {
  FilterFieldDef,
  FilterLogic,
  FilterRow,
  ListToolbarSubmit,
  SearchFieldOption,
} from '@/lib/listQuery'

export interface ListToolbarProps {
  searchFields: SearchFieldOption[]
  filterFields?: FilterFieldDef[]
  defaultSearch?: string
  defaultSearchField?: string
  defaultFilters?: FilterRow[]
  defaultFilterLogic?: FilterLogic
  /** Live search after idle ms. 0 / undefined = only Enter or magnifier. */
  debounceMs?: number
  showClear?: boolean
  showSearchButton?: boolean
  showFilter?: boolean
  placeholder?: string
  className?: string
  onSubmit: (payload: ListToolbarSubmit) => void
}

function newRowId() {
  return `f_${Math.random().toString(36).slice(2, 10)}`
}

function emptyRow(fields: FilterFieldDef[]): FilterRow {
  const first = fields[0]
  return {
    id: newRowId(),
    field: first?.value ?? '',
    value: '',
  }
}

function cloneRows(rows: FilterRow[]): FilterRow[] {
  return rows.map((r) => ({ ...r }))
}

export function ListToolbar({
  searchFields,
  filterFields = [],
  defaultSearch = '',
  defaultSearchField,
  defaultFilters = [],
  defaultFilterLogic = 'AND',
  debounceMs = 0,
  showClear = true,
  showSearchButton = true,
  showFilter = true,
  placeholder,
  className,
  onSubmit,
}: ListToolbarProps) {
  const { t } = useTranslation()
  const panelId = useId()

  const resolvedSearchFields = searchFields.length
    ? searchFields
    : [{ label: '—', value: '' }]

  const initialField =
    defaultSearchField && resolvedSearchFields.some((f) => f.value === defaultSearchField)
      ? defaultSearchField
      : resolvedSearchFields[0].value

  const [search, setSearch] = useState(defaultSearch)
  const [searchField, setSearchField] = useState(initialField)
  const [fieldMenuOpen, setFieldMenuOpen] = useState(false)

  // Applied filter state (last submitted)
  const [appliedFilters, setAppliedFilters] = useState<FilterRow[]>(() =>
    cloneRows(defaultFilters)
  )
  const [appliedLogic, setAppliedLogic] = useState<FilterLogic>(defaultFilterLogic)

  // Draft inside popover
  const [filterOpen, setFilterOpen] = useState(false)
  const [draftFilters, setDraftFilters] = useState<FilterRow[]>(() =>
    cloneRows(defaultFilters.length ? defaultFilters : [])
  )
  const [draftLogic, setDraftLogic] = useState<FilterLogic>(defaultFilterLogic)

  const filterBtnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const fieldMenuRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipDebounceRef = useRef(false)

  const filtersActive = appliedFilters.some((r) => r.field && r.value !== '')
  const canFilter = showFilter && filterFields.length > 0
  const showFieldDropdown = resolvedSearchFields.length > 1

  /** Filter dropdown: drop id + current searchField */
  const availableFilterFields = useMemo(() => {
    return filterFields.filter(
      (f) => f.value !== 'id' && f.value !== searchField
    )
  }, [filterFields, searchField])

  const emit = useCallback(
    (
      nextSearch: string,
      nextField: string,
      nextFilters: FilterRow[],
      nextLogic: FilterLogic
    ) => {
      onSubmit({
        search: nextSearch.trim(),
        searchField: nextField,
        filters: nextFilters.filter((r) => r.field && r.value !== ''),
        filterLogic: nextLogic,
      })
    },
    [onSubmit]
  )

  const submitSearch = useCallback(() => {
    skipDebounceRef.current = true
    emit(search, searchField, appliedFilters, appliedLogic)
  }, [search, searchField, appliedFilters, appliedLogic, emit])

  // Debounced live search
  useEffect(() => {
    if (!debounceMs || debounceMs <= 0) return
    if (skipDebounceRef.current) {
      skipDebounceRef.current = false
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      emit(search, searchField, appliedFilters, appliedLogic)
    }, debounceMs)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search, searchField, debounceMs]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close menus on outside click
  useEffect(() => {
    if (!filterOpen && !fieldMenuOpen) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (filterOpen && panelRef.current && !panelRef.current.contains(t) && !filterBtnRef.current?.contains(t)) {
        // Cancel semantics: revert draft
        setDraftFilters(cloneRows(appliedFilters))
        setDraftLogic(appliedLogic)
        setFilterOpen(false)
      }
      if (fieldMenuOpen && fieldMenuRef.current && !fieldMenuRef.current.contains(t)) {
        setFieldMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [filterOpen, fieldMenuOpen, appliedFilters, appliedLogic])

  function openFilter() {
    const fields = availableFilterFields.length ? availableFilterFields : filterFields
    const allowed = new Set(fields.map((f) => f.value))
    const fallback = fields[0]?.value ?? ''
    if (appliedFilters.length) {
      setDraftFilters(
        cloneRows(appliedFilters).map((r) =>
          allowed.has(r.field) ? r : { ...r, field: fallback, value: '' }
        )
      )
    } else {
      setDraftFilters([emptyRow(fields)])
    }
    setDraftLogic(appliedLogic)
    setFilterOpen(true)
  }

  function applyFilter() {
    // Drop empty / duplicate field+value
    const seen = new Set<string>()
    const cleaned: FilterRow[] = []
    for (const row of draftFilters) {
      if (!row.field || row.value === '') continue
      const key = `${row.field}::${row.value}`
      if (seen.has(key)) continue
      seen.add(key)
      cleaned.push({ ...row })
    }
    setAppliedFilters(cleaned)
    setAppliedLogic(draftLogic)
    setFilterOpen(false)
    emit(search, searchField, cleaned, draftLogic)
  }

  function cancelFilter() {
    setDraftFilters(cloneRows(appliedFilters))
    setDraftLogic(appliedLogic)
    setFilterOpen(false)
  }

  function resetFilter() {
    const cleared: FilterRow[] = []
    const fields = availableFilterFields.length ? availableFilterFields : filterFields
    setDraftFilters([emptyRow(fields)])
    setDraftLogic('AND')
    setAppliedFilters(cleared)
    setAppliedLogic('AND')
    emit(search, searchField, cleared, 'AND')
  }

  function clearSearch() {
    setSearch('')
    skipDebounceRef.current = true
    emit('', searchField, appliedFilters, appliedLogic)
  }

  function onSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      submitSearch()
    }
  }

  function updateDraftRow(id: string, patch: Partial<FilterRow>) {
    setDraftFilters((rows) =>
      rows.map((r) => {
        if (r.id !== id) return r
        const next = { ...r, ...patch }
        // Changing field clears value to avoid type mismatch
        if (patch.field != null && patch.field !== r.field) {
          next.value = ''
        }
        return next
      })
    )
  }

  function addDraftRow() {
    const fields = availableFilterFields.length ? availableFilterFields : filterFields
    setDraftFilters((rows) => [...rows, emptyRow(fields)])
  }

  function removeDraftRow(id: string) {
    setDraftFilters((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.id !== id)))
  }

  function isDuplicate(row: FilterRow): boolean {
    if (!row.field || row.value === '') return false
    return draftFilters.some(
      (r) => r.id !== row.id && r.field === row.field && r.value === row.value
    )
  }

  const fieldDef = useMemo(() => {
    const map = new Map(filterFields.map((f) => [f.value, f]))
    return map
  }, [filterFields])

  return (
    <div className={cn('flex flex-col gap-2 sm:flex-row sm:items-center', className)}>
      {/* Search box */}
      <div className="relative flex-1 min-w-0">
        <div className="flex h-9 items-stretch rounded-md border border-input bg-transparent shadow-sm focus-within:ring-1 focus-within:ring-ring overflow-hidden">
          {/* Search field dropdown (start side) */}
          {showFieldDropdown && (
            <div className="relative shrink-0 border-e border-input" ref={fieldMenuRef}>
              <button
                type="button"
                className="flex h-full items-center gap-1 px-2.5 text-xs font-medium text-foreground/80 hover:text-foreground cursor-pointer max-w-[9rem]"
                onClick={() => setFieldMenuOpen((o) => !o)}
              >
                <span className="truncate">
                  {resolvedSearchFields.find((f) => f.value === searchField)?.label ??
                    searchField}
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
              </button>
              {fieldMenuOpen && (
                <div className="absolute start-0 top-full z-50 mt-1 min-w-[10rem] rounded-md border bg-popover text-popover-foreground p-1 shadow-md">
                  {resolvedSearchFields.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      className={cn(
                        'flex w-full rounded-sm px-2 py-1.5 text-start text-sm cursor-pointer text-foreground hover:bg-accent hover:text-accent-foreground',
                        f.value === searchField && 'bg-accent text-accent-foreground'
                      )}
                      onClick={() => {
                        setSearchField(f.value)
                        setFieldMenuOpen(false)
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Clear (X): reserved width when enabled to avoid layout jump */}
          {showClear && (
            <button
              type="button"
              className={cn(
                'shrink-0 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground',
                search.length > 0 ? 'cursor-pointer visible' : 'invisible pointer-events-none'
              )}
              onClick={clearSearch}
              aria-label={t('common.clear')}
              tabIndex={search.length > 0 ? 0 : -1}
            >
              <X className="h-4 w-4" />
            </button>
          )}

          <input
            className="min-w-0 flex-1 bg-transparent py-1 pe-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={onSearchKey}
            placeholder={placeholder ?? t('common.search')}
          />

          {showSearchButton && (
            <button
              type="button"
              className="shrink-0 px-2.5 text-muted-foreground hover:text-foreground border-s border-input cursor-pointer"
              onClick={submitSearch}
              aria-label={t('common.search')}
            >
              <Search className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter */}
      {canFilter && (
        <div className="relative shrink-0">
          <Button
            ref={filterBtnRef}
            type="button"
            variant="outline"
            className={cn(
              filtersActive &&
                'border-primary bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
            )}
            onClick={() => (filterOpen ? cancelFilter() : openFilter())}
            aria-expanded={filterOpen}
            aria-controls={panelId}
          >
            <Filter className="h-4 w-4" />
            {t('common.filter')}
          </Button>

          {filterOpen && (
            <div
              id={panelId}
              ref={panelRef}
              className="absolute end-0 top-full z-50 mt-2 w-[min(100vw-2rem,28rem)] rounded-lg border bg-popover p-3 shadow-lg"
              role="dialog"
              aria-label={t('common.filter')}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('listToolbar.logic')}
                  </span>
                  <div className="inline-flex rounded-md border p-0.5">
                    {(['AND', 'OR'] as const).map((logic) => (
                      <button
                        key={logic}
                        type="button"
                        className={cn(
                          'px-2.5 py-0.5 text-xs rounded cursor-pointer',
                          draftLogic === logic
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                        onClick={() => setDraftLogic(logic)}
                      >
                        {logic}
                      </button>
                    ))}
                  </div>
                </div>
                {filtersActive && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title={t('listToolbar.reset')}
                    onClick={resetFilter}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {draftFilters.map((row) => {
                  const def = fieldDef.get(row.field)
                  const dup = isDuplicate(row)
                  return (
                    <div key={row.id} className="flex flex-wrap items-center gap-1.5">
                      <select
                        className="h-8 min-w-[7rem] flex-1 rounded-md border border-input bg-background text-foreground px-2 text-xs"
                        value={
                          availableFilterFields.some((f) => f.value === row.field)
                            ? row.field
                            : availableFilterFields[0]?.value ?? ''
                        }
                        onChange={(e) => updateDraftRow(row.id, { field: e.target.value })}
                      >
                        {availableFilterFields.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>

                      <ValueControl
                        def={def}
                        value={row.value}
                        invalid={dup}
                        onChange={(v) => updateDraftRow(row.id, { value: v })}
                      />

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        disabled={draftFilters.length <= 1}
                        onClick={() => removeDraftRow(row.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      {dup && (
                        <span className="w-full text-[10px] text-destructive">
                          {t('listToolbar.duplicate')}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <Button type="button" variant="outline" size="sm" onClick={addDraftRow}>
                  <Plus className="h-3.5 w-3.5" />
                  {t('listToolbar.addRow')}
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={cancelFilter}>
                    {t('common.cancel')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={applyFilter}
                    disabled={draftFilters.some(isDuplicate)}
                  >
                    {t('common.filter')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ValueControl({
  def,
  value,
  onChange,
  invalid,
}: {
  def?: FilterFieldDef
  value: string
  onChange: (v: string) => void
  invalid?: boolean
}) {
  const { t } = useTranslation()
  const type = def?.type ?? 'string'
  const base =
    'h-8 min-w-[7rem] flex-1 rounded-md border bg-background text-foreground px-2 text-xs ' +
    (invalid ? 'border-destructive' : 'border-input')

  if (type === 'boolean') {
    return (
      <select className={base} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t('listToolbar.selectValue')}</option>
        <option value="true">{t('common.enabled')}</option>
        <option value="false">{t('common.disabled')}</option>
      </select>
    )
  }

  if (type === 'enum' && def?.options?.length) {
    return (
      <select className={base} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t('listToolbar.selectValue')}</option>
        {def.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    )
  }

  return (
    <Input
      className={cn(base, 'h-8')}
      type={type === 'number' ? 'number' : 'text'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t('listToolbar.value')}
    />
  )
}
