# Overlays

Use overlays only when they reduce friction more than they add complexity.

## Choose The Right Pattern

- `Dialog`: short focused tasks, confirmations, destructive actions
- `Sheet`: create/edit flows and detail panels that should preserve the current page context
- `Collapsible` or inline expansion: secondary detail within a page section

## Dialog Pattern

Use for:

- delete confirmation
- quick confirmations
- short two-step decisions

Example shape:

```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button variant="destructive">Delete service</Button>
  </DialogTrigger>

  <DialogContent>
    <DialogHeader>
      <DialogTitle>Delete service</DialogTitle>
      <DialogDescription>This action cannot be undone.</DialogDescription>
    </DialogHeader>

    <DialogFooter>
      <Button variant="outline">Cancel</Button>
      <Button variant="destructive">Delete</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## Sheet Pattern

Use for:

- create or edit flows
- contextual detail views
- multi-field tasks that should not interrupt the surrounding page

Rules:

- Keep the title explicit
- Keep the form self-contained
- Preserve the user’s list or page context behind the sheet

## Overlay Rules

- Do not put large multi-section page architecture inside a dialog
- Do not use overlays for content that should simply live on the page
- Destructive overlays should say exactly what will happen
- Keep footer actions simple: cancel plus one clear primary action
