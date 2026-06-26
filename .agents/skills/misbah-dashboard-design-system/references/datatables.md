# Datatables

Use this reference for list screens, operational tables, and any filterable record view in Misbah Admin.

## Stack

- The shared datatable component system in `src/components/datatable` as the primary table layer
- `@tanstack/react-table` under the hood
- Next App Router search params as the source of truth for search, filters, sorting, and pagination
- Route-local wiring in `src/app/(main)/**/_libs/table` plus shared helpers like `useTableFilters`

## Standard Composition

Use these pieces before inventing new table UI:

- `DataTable`
- `DataTableToolbar`
- `DataTableSearch`
- `DataTableFacetedFilter`
- `DataTableDateRangeFilter`
- `DataTableResetButton`
- `DataTableActiveFilters`
- `DataTableViewOptions`
- `DataTableColumnHeader`

## Query Param Rules

- Search is usually stored in `search`
- Page index uses `page`
- Page size uses `pageSize`
- Sorting commonly uses `orderBy` and `direction`
- Multi-select filters should use the stable string format already established on the page, typically comma-separated values
- Filter changes reset page to `1`

## Toolbar Rules

- Search belongs in the toolbar
- Faceted filters belong beside search
- Reset belongs in the toolbar when filters are active
- Active filter chips belong directly below or beside the toolbar
- Column visibility belongs in view options
- Do not move core table controls into page-level hero sections

## Table State UX

- Initial load: skeleton rows or loading placeholders in the table region
- Empty state: concise message inside the table region
- Refetch: keep visible data when possible
- Pagination: compact and operational, not oversized
- Dense rows should remain readable in both themes

## Example Shape

```tsx
const {
  globalFilter,
  setGlobalFilter,
  activeFilters,
  updateFilters,
  clearAllFilters,
  hasActiveFilters,
  applySearch,
  clearSearch,
} = useTableFilters(filterConfigs)

return (
  <>
    <DataTableToolbar
      search={
        <DataTableSearch
          placeholder="Search services"
          value={globalFilter}
          onChange={setGlobalFilter}
          onSearch={applySearch}
          onClear={clearSearch}
        />
      }
      filters={
        <>
          <DataTableFacetedFilter
            config={statusConfig}
            value={statusValue}
            options={statusOptions}
            onValueChange={(value) => updateFilters("status", value)}
          />

          <DataTableResetButton visible={hasActiveFilters} onClick={clearAllFilters} />
        </>
      }
    />

    <DataTableActiveFilters
      activeFilters={activeFilters}
      onRemoveFilter={(key) => updateFilters(key, null)}
    />

    <DataTable data={rows} columns={columns} />
  </>
)
```

## Implementation Shape

The common flow is:

1. Read values from `useSearchParams()` or a shared hook that wraps it.
2. Parse into typed filter state.
3. Update params through one centralized helper.
4. Reset page when search, filters, or sorting change.
5. Render controls through the shared datatable components.

Do not keep a second source of truth for table filters in local component state unless the interaction requires a temporary draft state.
