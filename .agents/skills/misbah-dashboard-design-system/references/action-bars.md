# Action Bars

Use this reference for page actions, form footers, and datatable toolbars.

## Core Rules

- One primary action per action group
- Secondary actions should be visually quieter
- Destructive actions should be separated from save/submit actions
- Keep action labels direct and specific

## Form Footer Pattern

Use for settings and edit flows.

Example shape:

```tsx
<div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
  <p className="text-sm text-muted-foreground">Changes apply to this record only.</p>

  <div className="flex gap-2">
    <Button variant="outline" onClick={resetForm}>
      Reset
    </Button>
    <Button disabled={isSubmitting}>Save changes</Button>
  </div>
</div>
```

## Page Action Row

Use for higher-level page actions near the header.

Rules:

- Keep the action row compact
- Do not repeat the same action in both header and card footer
- If the page already has a primary submit action in a form, the page header usually does not need another primary action

## Toolbar Action Row

Use for table or list actions.

Rules:

- Search and filters first
- View controls second
- Bulk or contextual actions last
- Keep the toolbar responsive; stack instead of compressing everything into a single cramped row
