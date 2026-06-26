# Forms

Use this reference for settings forms and operational edit flows in Misbah Admin.

## Stack

- `react-hook-form` for form state
- `zod` with `zodResolver` when a schema exists
- Local `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, and `FormMessage` primitives from `src/components/ui/form.tsx`
- shadcn inputs such as `Input`, `Textarea`, `Select`, `Checkbox`, and `Calendar`
- Route-local actions plus `router.push()` or refresh behavior for submit completion
- Toast for submit feedback when the flow already uses it

## Expected Structure

1. Start with a `Card`
2. Add `CardHeader` with `CardTitle` and `CardDescription` when the section needs framing
3. Group related controls with grid/layout wrappers, not bespoke field DSLs
4. Render each field through `FormField`
5. Keep validation errors directly below the control
6. Put submit/reset actions at the bottom with clear pending state

## Example Shape

```tsx
const form = useForm<ServiceFormValues>({
  resolver: zodResolver(serviceSchema),
  defaultValues: {
    name: "",
    status: "active",
  },
})

<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>Basic information</CardTitle>
        <CardDescription>Essential service details used across the dashboard</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Service name</FormLabel>
              <FormControl>
                <Input placeholder="Enter service name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  </form>
</Form>
```

## Form Rules

- Labels sit above inputs
- Helper text is optional but should be purposeful
- Error text stays inline and close to the field
- Use schema validation where possible instead of hand-rolled checks in submit handlers
- Avoid custom field wrappers unless multiple pages need the same behavior
- Do not turn settings forms into wizard-like flows unless the user asks for that specifically
- Keep client-side form state in client components; let server pages load data and hand it down cleanly
