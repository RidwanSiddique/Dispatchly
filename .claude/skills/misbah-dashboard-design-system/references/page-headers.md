# Page Headers

Use these patterns for dashboard pages. Avoid marketing-style hero sections.

## 1. Settings Or Detail Pages

Use this for narrower pages such as settings, account pages, configuration screens, and detail views.

- Container: `mx-auto w-full max-w-4xl space-y-6`
- Top row: small icon badge + page title
- Divider: a simple top border under the title row
- Optional state area: success/error alerts directly below the header
- Main content: stacked cards or focused sections followed by forms

Visual behavior:

- Title should be direct and operational
- Descriptions should be one sentence, not promotional copy
- Keep the first action close to the title or inside the first card

Example shape:

```tsx
<div className="mx-auto w-full max-w-4xl space-y-6">
  <div className="space-y-4">
    <div className="flex items-center gap-3">
      <div className="bg-primary/10 border-primary/20 flex h-10 w-10 items-center justify-center rounded-lg border">
        <Settings2 className="text-primary h-5 w-5" />
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">School configuration</h1>
    </div>

    <div className="border-border border-t" />
  </div>

  {errorMessage ? (
    <Alert variant="destructive">
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{errorMessage}</AlertDescription>
    </Alert>
  ) : null}
</div>
```

## 2. Data-Heavy Pages

Use this for registrations, invoices, history views, and list screens.

- Prefer a wider layout
- Keep the page intro compact
- Let the datatable toolbar carry search, filters, and view options
- Do not add oversized banners above the table

## 3. Header Checklist

- Use a clear noun-based page title
- Add a short supporting description only if it improves task clarity
- Keep icon use minimal and functional
- Do not introduce large gradient backgrounds, hero illustrations, or centered landing-page layouts
- Keep alert messages below the header, not mixed into the title row
