/** Shared list query types + axios-friendly param builder (matches backend list_query.mjs). */

export type FilterLogic = 'AND' | 'OR'

export interface SearchFieldOption {
  label: string
  value: string
}

export type FilterFieldType = 'string' | 'number' | 'boolean' | 'enum'

export interface FilterFieldOption {
  label: string
  value: string
}

export interface FilterFieldDef {
  value: string
  label: string
  type: FilterFieldType
  /** Required for type === 'enum' */
  options?: FilterFieldOption[]
}

export interface FilterRow {
  id: string
  field: string
  value: string
}

export interface ListToolbarSubmit {
  search: string
  searchField: string
  filters: FilterRow[]
  filterLogic: FilterLogic
}

export interface ListQueryParams {
  page?: number
  limit?: number
  search?: string
  searchField?: string
  filters?: FilterRow[]
  filterLogic?: FilterLogic
  sortBy?: string
  sortDir?: 'ASC' | 'DESC'
}

/**
 * Build flat query params for axios.
 * Multi-value same field → comma-separated (backend accepts comma lists).
 */
export function buildListQueryParams(q: ListQueryParams): Record<string, string | number> {
  const params: Record<string, string | number> = {}

  if (q.page != null) params.page = q.page
  if (q.limit != null) params.limit = q.limit

  const search = q.search?.trim()
  if (search && q.searchField) {
    params.search = search
    params.searchField = q.searchField
  }

  if (q.filterLogic) {
    params.filterLogic = q.filterLogic
  }

  if (q.filters?.length) {
    const byField = new Map<string, string[]>()
    for (const row of q.filters) {
      if (!row.field || row.value === '') continue
      const list = byField.get(row.field) ?? []
      if (!list.includes(row.value)) list.push(row.value)
      byField.set(row.field, list)
    }
    for (const [field, values] of byField) {
      params[`filter[${field}]`] = values.join(',')
    }
  }

  if (q.sortBy) {
    params.sortBy = q.sortBy
    params.sortDir = q.sortDir ?? 'ASC'
  }

  return params
}
