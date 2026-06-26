# States

Use this reference for loading, empty, success, and error behavior in Misbah Admin.

## Loading

Rules:

- Keep the layout shape visible
- Prefer skeletons over generic spinners for page and table content
- Avoid full-screen loading takeovers unless the page truly has no usable content yet

Example shape:

```tsx
<Card>
  <CardHeader className="space-y-2">
    <Skeleton className="h-6 w-40" />
    <Skeleton className="h-4 w-72" />
  </CardHeader>

  <CardContent className="space-y-3">
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-10 w-full" />
  </CardContent>
</Card>
```

## Empty

Rules:

- Keep the message concise
- Explain what is missing
- Provide a next action when appropriate

Example shape:

```tsx
<Card className="border-dashed">
  <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
    <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-lg">
      <Search className="h-5 w-5 text-muted-foreground" />
    </div>

    <div className="space-y-1">
      <p className="font-medium">No invoices found</p>
      <p className="text-sm text-muted-foreground">Try changing the filters or clearing the search.</p>
    </div>

    <Button variant="outline" onClick={resetFilters}>
      Clear filters
    </Button>
  </CardContent>
</Card>
```

## Error

Rules:

- Page-level failures use inline `Alert`
- Field-level failures stay under the field
- Error copy should state the failure plainly

Example shape:

```tsx
<Alert variant="destructive">
  <AlertTitle>Could not load invoices</AlertTitle>
  <AlertDescription>Refresh the page or try again in a moment.</AlertDescription>
</Alert>
```

## Success

Rules:

- Use toast for transient save success
- Keep the tone calm
- Do not celebrate routine admin actions

Example phrases:

- `Settings saved`
- `Invoice sent`
- `Changes restored`

## Pending Actions

Rules:

- Disable the primary action while pending
- Show a spinner only where it clarifies the active action
- Keep button labels readable while loading

Example shape:

```tsx
<Button disabled={isSubmitting}>
  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
  Save changes
</Button>
```
