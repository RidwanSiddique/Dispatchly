# Anti-Patterns

Use this reference to avoid common dashboard design mistakes.

## Prefer clarity over decoration

Avoid:

- oversized hero-like page headers
- multiple competing primary buttons in the same section
- decorative icons without structural meaning
- large branded color fills behind ordinary admin content

Prefer:

- compact task-oriented headers
- one clear primary action per local area
- icons only when they clarify section type or state
- neutral surfaces with targeted emphasis

## Prefer system primitives over custom wrappers

Avoid:

- ad hoc form wrappers that bypass the shared `Form*` primitives
- custom table layouts for standard list screens
- one-off button variants for routine actions
- bespoke overlays where `Dialog` or `Sheet` is enough

Prefer:

- `FormField`, `FormLabel`, `FormDescription`, and `FormMessage`
- the shared datatable system
- existing action variants
- standard overlays first

## Prefer tokenized styling over hard-coded visuals

Avoid:

- raw hex colors for common UI states
- adding borders to every region
- exaggerated border radius on regular dashboard surfaces
- strong shadows to manufacture hierarchy

Prefer:

- semantic tokens
- spacing and typography before extra chrome
- the existing radius scale
- subtle structural separation

## Prefer simple state models

Avoid:

- local filter state that diverges from the URL search params
- wiping the screen during background refetches
- hiding validation away from the relevant field
- using toasts for everything, including core page errors

Prefer:

- URL-driven filters and pagination
- persistent visible content during refetches
- inline field validation
- inline `Alert` for page-level failures
