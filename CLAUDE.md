# iShortn

Link shortener: Next.js 16 on Cloudflare Workers (OpenNext), tRPC 10, Drizzle on MySQL, Clerk,
Tailwind 3 + shadcn/ui, Bun. Setup and day-to-day workflow are in `CONTRIBUTING.md`; this file is
the rules. Every rule below points at the code it was taken from; when in doubt, copy that file.

## Layout

| What                     | Where                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Dashboard pages          | `src/app/(main)/dashboard/<feature>/page.tsx`, private components in `_components/`                                            |
| Marketing and auth       | `src/app/(landing)`, `src/app/(auth)`; separate design language in `docs/design-language.md`                                   |
| Docs (`/docs`)           | MDX in `content/docs/`, nav in `src/lib/docs/navigation.ts`, pages in `src/app/(docs)/docs-site` (middleware rewrites `/docs`) |
| Redirect path            | `src/app/(links)/[linkAlias]/page.tsx` and `src/middlewares/` (`resolve-link.ts`, `record-click.ts`)                           |
| Short-link surfaces      | `src/app/(links)` (redirect, state pages, previews, bio pages): no Clerk or analytics; app routes get them from `AppProviders` |
| Edge middleware          | `src/middleware.ts` (Clerk + custom-domain bio rewrite; must stay edge-safe, no db/pino imports)                               |
| tRPC procedures          | `src/server/api/trpc.ts` (`publicProcedure`, `protectedProcedure`, `workspaceProcedure`, `teamProcedure`, `adminProcedure`, …) |
| tRPC routers + services  | `src/server/api/routers/<feature>/<feature>.{input,procedure,service}.ts`, registered in `src/server/api/root.ts`              |
| Workspace / permissions  | `src/server/lib/workspace/` (`workspaceFilter`, `workspaceOwnership`, `requirePermission`, `requireFolderAccess`, …)           |
| DB schema                | `src/server/db/schema.ts`; client in `src/server/db/index.ts`                                                                  |
| Migrations               | `drizzle/` (generated, applied to production only)                                                                             |
| REST API, webhooks, cron | `src/app/api/{v1,webhooks,cron,queue}`                                                                                         |
| UI primitives            | `src/components/ui` (shadcn, excluded from oxfmt)                                                                              |
| Env vars                 | `src/env.mjs` + `.env.example`; server code reads `env`, not `process.env`                                                     |
| Tests                    | next to the code as `*.test.ts` (`bun:test`), preload in `test/setup.ts`                                                       |

## Commands

```bash
bun run typecheck   # tsc --noEmit
bun run lint        # oxlint, incl. anti-slop rules in tools/oxlint/anti-slop
bun run format      # oxfmt (printWidth 100, sorted import groups; see .oxfmtrc.json)
bun test
bun run db:push     # apply schema.ts to your local DB (what `bun run setup` does)
bun run db:generate # write the SQL migration under drizzle/ for production
```

`drizzle/` is deploy-only: its chain started against production and does not replay on an empty
database, so local databases use `db:push`, never `db:migrate` (`CONTRIBUTING.md`, "Schema
changes"). Commit the schema change and the generated migration together.

## Dashboard design language

Applies to `src/app/(main)/dashboard/**`. The marketing and auth pages have their own light-only
system in `docs/design-language.md`; don't mix the two.

**Rule: new UI uses only the components, classes and sizes listed here. No new colours, fonts,
shadows, animation styles, or arbitrary values beyond the ones already in use below.**

### Shell

`dashboard/layout.tsx` sets the font (Funnel Sans), the canvas `bg-neutral-50 dark:bg-accent/50`,
the 280px sidebar, and the content column `max-w-[1180px] px-4 sm:px-6 lg:px-8`. Pages render only
their content; never add another max-width wrapper or font.

### Colour pairs (light → dark)

The dashboard uses `neutral-*` in light mode and the theme tokens from `src/styles/globals.css` in
dark mode. Always write both halves of the pair:

| Role                        | Classes                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Headings, primary text      | `text-neutral-900 dark:text-foreground`                                                                            |
| Labels, body                | `text-neutral-700 dark:text-neutral-300`                                                                           |
| Secondary text              | `text-neutral-500 dark:text-neutral-400`                                                                           |
| Muted text, meta, icons     | `text-neutral-400 dark:text-muted-foreground`                                                                      |
| Surface (cards, inputs)     | `bg-white dark:bg-card`                                                                                            |
| Soft fill (icon tiles, bar) | `bg-neutral-100 dark:bg-muted`                                                                                     |
| Subtle panel, table header  | `bg-neutral-50 dark:bg-accent/50`                                                                                  |
| Border                      | `border-neutral-200 dark:border-border`                                                                            |
| Inner divider               | `border-neutral-100 dark:border-border/50`; lists `divide-y divide-neutral-300/60 dark:divide-border`              |
| Row/ghost hover             | `hover:bg-neutral-50 dark:hover:bg-accent/50` or `hover:bg-neutral-100 dark:hover:bg-accent`                       |
| Primary action              | `bg-blue-600 text-white hover:bg-blue-700`                                                                         |
| Link / info accent          | `text-blue-600 dark:text-blue-400`, tint `bg-blue-50 dark:bg-blue-500/10`                                          |
| Error / destructive         | `text-red-600 dark:text-red-400`, tint `bg-red-50 dark:bg-red-500/10`, button `bg-red-600 hover:bg-red-700`        |
| Warning                     | `text-amber-700 dark:text-amber-400`, `bg-amber-50 dark:bg-amber-500/10`, `border-amber-200 dark:border-amber-800` |
| Success                     | `text-emerald-600 dark:text-emerald-400`, `bg-emerald-50 dark:bg-emerald-500/10`                                   |

Charts use `ChartContainer` from `ui/chart.tsx` with a `chartConfig` whose series colours are
referenced as `var(--color-<key>)`; the main series is `#2563eb` (blue-600), the secondary
`#93c5fd` (`analytics/overview/_components/overall-clicks-chart.tsx`).

### Type, spacing, radius, icons

- Type scale (pixel sizes are the established convention here): page title
  `text-xl font-semibold tracking-tight`; card/dialog/row titles `text-[14px] font-medium` or
  `font-semibold`; body, inputs and buttons `text-[13px]`; meta and helper text `text-[12px]`;
  badges and eyebrows `text-[11px]`. Weights: `font-medium`, `font-semibold`; avoid `font-bold`.
- Spacing: `gap-1.5`/`gap-2`/`gap-3`, `space-y-1.5` (label + field), `space-y-3`/`space-y-4`
  between blocks, card padding `p-4` or `p-5`, page header `mb-8`.
- Radius: `rounded-lg` for buttons, inputs, small panels and tables; `rounded-xl` for cards,
  dialogs and icon tiles; `rounded-md` for icon buttons and chips; `rounded-full` for pills and dots.
- Shadows: none on dashboard cards (`shadow-none` overrides the `Card` default); dialogs and
  floating bars keep the primitive's shadow.
- Icons: `@tabler/icons-react` with `size={14}`–`{16}` and `stroke={1.5}` (`stroke={2}` on
  primary-button icons). `lucide-react` exists only in older files; don't add new uses.

### Components (`src/components/ui`)

| Need                        | Use                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| Buttons                     | `Button` (`variant="ghost"`/`"outline"` for secondary; primary overrides to `bg-blue-600`) |
| Forms                       | `Input`, `Textarea`, `Label`, `Select`, `Switch`, `Checkbox`, `Form` (react-hook-form)     |
| Create/edit flows           | `Dialog` with `DialogHeader`, `DialogBody`, `DialogFooter`                                 |
| Confirm destructive actions | `AlertDialog`                                                                              |
| Row actions / menus         | `DropdownMenu`; pickers in `Popover` + `Command`; dates `Calendar`                         |
| Grouped content             | `Card`                                                                                     |
| Status labels               | `Badge`, or the inline chip in `folder-card.tsx`                                           |
| Loading placeholders        | `Skeleton`                                                                                 |
| Hints                       | `Tooltip`; tabs `Tabs`; progress `Progress`; avatars `Avatar`; long lists `ScrollArea`     |
| Toasts                      | `toast` from `sonner` (the `Toaster` in `ui/sonner.tsx` is already mounted)                |

Don't add new primitives or restyle the existing ones.

### Exemplary files (copy these)

All under `src/app/(main)/dashboard/`:

- **Page + header**: `folders/page.tsx` (server fetch with `Promise.all`) and
  `folders/_components/folders-view.tsx` (header row, title + count, primary button).
- **List rows**: `folders/_components/folder-card.tsx` (stretched link, `truncate`, meta row with
  `&middot;`, hover-revealed icon buttons).
- **Card**: `campaigns/[slug]/_components/campaign-overview.tsx`
  (`<Card className="rounded-xl border-neutral-200 p-5 shadow-none dark:border-border">`).
- **Table**: `admin/users/page.tsx` (`rounded-lg border` wrapper, `bg-neutral-50` header row,
  `px-4 py-3` cells, low-priority columns `hidden md:table-cell`).
- **Dialog form**: `folders/_components/create-folder-modal.tsx`.
- **Destructive confirm**: `folders/_components/delete-folder-dialog.tsx`.
- **Empty state**: `domains/_components/empty-state.tsx` (icon tile `h-14 w-14 rounded-xl
  bg-neutral-100 dark:bg-muted`, `text-[14px]` title, `max-w-xs text-[13px]` copy, one action).
  Inline empty results: the dashed panel in `admin/users/page.tsx`.
- **Loading**: `folders/loading.tsx` (route `loading.tsx` with `Skeleton`s matching the layout).
- **Error boundary**: `error.tsx`.
- **Toasts**: mutations call `toast.success("…")` in `onSuccess` and `toast.error(error.message)`
  in `onError` (`create-folder-modal.tsx`); `toast.promise` for long actions
  (`_components/bulk-actions/bulk-actions.tsx`).

## UX rules

- **Loading**: every new route gets a `loading.tsx` with Skeletons shaped like the content. Client
  `useQuery` data shows Skeletons while `isLoading`. Submit buttons disable and relabel while the
  mutation runs (`"Creating..."`).
- **Empty**: every list has an empty state (see above), including "no results" for searches.
- **Errors**: server-rendered pages fall through to `dashboard/error.tsx`; client queries render an
  inline message; mutations toast `error.message`. Field errors sit under the field in
  `text-[12px] text-red-500`.
- **Mobile (390px) and desktop**: stack with `flex-col sm:flex-row`, collapse grids to one column,
  hide low-priority table columns (`hidden md:table-cell`), dialogs are full width on mobile and `sm:max-w-[440px]` or `sm:max-w-[480px]` above.
- **Dark mode**: every colour class has its `dark:` pair from the table above.
- **Keyboard**: actions are `<button type="button">` or links, never clickable `div`s. Icon-only
  buttons need an `aria-label`. Use Radix-based primitives for menus and dialogs so focus is handled.
  Hover-revealed controls (`opacity-0 group-hover:opacity-100` in `folder-card.tsx`) must also
  appear on focus (`group-focus-within:opacity-100`).
- **Long text and big numbers**: `min-w-0` on flex children plus `truncate` (or `break-all` for
  URLs); counts use `tabular-nums` and `toLocaleString()`; pluralise (`1 link` / `2 links`).

## Performance rules

- **The redirect path is the product.** Plain links are answered first from KV by
  `custom-worker.ts` → `src/middlewares/cached-redirect.ts`, without loading Next (which costs ~100ms
  of CPU per click). Its imports must stay free of db, logger (`server-only` throws outside Next)
  and anything that needs `process.env` at load time; it returns null for anything it can't answer
  exactly like the page, and Next takes over. Everything else: `[linkAlias]/page.tsx` → `resolveShortLink`
  (`src/middlewares/resolve-link.ts`) → `resolveLink` (cache-first, `src/lib/core/cache`) →
  `recordClick`, which only enqueues (`src/server/lib/click-queue.ts`). Do not add a DB query,
  external call or `await` there without removing more cost than you add. Side effects go through
  `runBackgroundTask` (`src/lib/utils/background.ts`) so they run after the response.
- `src/middleware.ts` runs on every request: no DB access, Node-only imports or network calls.
- **No N+1**: never query inside `.map`/`Promise.all` per row. Batch with `inArray` +
  `groupBy` (see `campaign.service.ts` and `qrcode.service.ts`). `listFolders` in
  `folder.service.ts` still does one count per folder; don't copy it.
- **No unbounded queries**: lists that can grow take `page`/`pageSize` with a zod max
  (`link.input.ts`: `pageSize: z.number().min(1).max(100)`) and use `.limit()`/`.offset()`
  (`link.service.ts`). New filters on large tables need an index in `schema.ts`.
- **No client waterfalls**: fetch in the server page with `Promise.all` (`folders/page.tsx`) and
  pass data down instead of chaining client queries.
- **Dependencies**: prefer what's installed (date-fns, zod, framer-motion, recharts, sonner,
  tabler icons). Adding a package needs a clear reason.

## Data safety

- Schema changes are additive only: new tables, nullable or defaulted columns, new indexes. Never
  write or generate a migration that drops, renames or deletes data.
- Every workspace-owned query filters with `workspaceFilter(ctx.workspace, table.userId,
  table.teamId)` and inserts with `workspaceOwnership(ctx.workspace)`
  (`src/server/lib/workspace/query-helpers.ts`). Lookups by id include the workspace filter and
  throw `NOT_FOUND` when missing (`getFolder` in `folder.service.ts`).
- Never weaken or bypass procedure guards (`workspaceProcedure`, `teamProcedure`, `adminProcedure`,
  `ultraProcedure`), role checks (`requirePermission`, `requireMinimumRole`) or folder access
  checks (`requireFolderAccess`). Plan limits are enforced on the server (`getPlanCaps` in
  `createFolder`), not just hidden in the UI.

## Code style

- **Routers**: one folder per feature with `<feature>.input.ts` (zod schemas named
  `createFolderInput` and types `CreateFolderInput`), `<feature>.procedure.ts` (thin: pick the
  procedure, `.input()`, call the service; exported as `folderRouter`) and `<feature>.service.ts`.
  Register in `root.ts`. (`geo-rules` and `tag` use `.router.ts`; new features use `.procedure.ts`.)
- **Services**: `export const verbNoun = async (ctx: WorkspaceTRPCContext, input: XInput) => {}`.
  Use `ctx.db`; wrap check-then-write in `ctx.db.transaction` (`createFolder`). Fail with
  `new TRPCError({ code, message })` where `message` is user-facing; the client toasts it.
- **Pure logic** lives in `utils.ts` beside the service with a `utils.test.ts`
  (`routers/campaign/`). Tests use `bun:test` and real inputs; module mocking is a lint error
  (`anti-slop/no-module-mocking`).
- **Types**: no `any`; every `as` assertion needs a `// SAFETY:` comment stating the invariant
  (`anti-slop/require-safety-comment-for-type-assertion`). Client types come from
  `RouterOutputs`/`RouterInputs` in `@/trpc/shared`.
- **Naming**: kebab-case files, PascalCase components, camelCase functions; imports via `@/`.
- **Comments**: sparse, and about _why_: invariants, platform quirks and non-obvious choices
  (`src/middleware.ts`, `resolve-link.ts`, the stretched-link note in `folder-card.tsx`). JSX may
  carry short section labels (`{/* Header */}`). Don't narrate what the code says.
- **Logging**: `logger.child({ component: "…" })` from `@/lib/logger` on the server,
  `clientLogger` in the browser; no `console.log`.
- Commits use conventional prefixes (`feat:`, `fix:`, `chore:`, `docs:`).
