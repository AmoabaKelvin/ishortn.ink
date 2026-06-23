# Link-in-Bio — Implementation Plan

Status: **Built end-to-end (Phases 0–6), typecheck + production build pass.** Branch:
`AmoabaKelvin/link-in-bio`. Roadmap origin: Phase 2 of the Product Growth Roadmap
(`01 Link-in-Bio Pages.md`).

**Before this ships:** apply migration `drizzle/0063_*.sql` to the database (`bun run db:migrate`)
— it was generated but intentionally not applied here.

**Also built:** auto-generated OG images via colocated `opengraph-image` routes for `/p/[slug]` and
the custom-domain root (shared `src/components/bio/og-image.tsx` — honors a Pro `socialImageUrl` or
generates from avatar/name/handle/theme; font-free, consistent with the existing `/blog` OG route);
Ultra scheduled-block date pickers in the block editor (gated to Ultra; the public renderer already
filters by current time).

**Remaining deferred follow-ups (non-blocking):**
- `/p/[slug]` renders dynamically (the tRPC server caller reads headers), so `revalidate = 60` is
  currently moot; could be made truly static/ISR by querying the DB directly in the route.
- DB-dependent service/integration tests — repo has no test/DB harness; pure-function tests
  (theme + slug rules) were added and pass. The DB-level cases (slug uniqueness, caps, lifecycle,
  cache invalidation, blocked-link, custom-domain render) remain to be added with a DB harness.
- Admin "block whole bio page" moderation — per-link blocking already disables abusive blocks.

## 1. What we're building and why

A public bio page (Linktree-style) where a user collects their important links, socials, and
content in one place. The decisive design choice: **every link block is backed by a real iShortn
`link` row**, so every click flows through the existing redirect + analytics pipeline. Per-block
click data, geo/device/referrer, unique visits, UTM, verified clicks, and QR all come for free.

**Positioning / wedge:** _"The link-in-bio that actually tells you what's working."_ Tracking-first,
not design-first or commerce-first. Linktree gates analytics hard (Free = 28-day aggregates, no
geo/device/referrer); iShortn already computes all of that server-side and bot-filtered. That is the
differentiator we lead with.

We are building this **end-to-end**, not as a stripped MVP slice — full builder, public page,
analytics, themes, QR, custom domain, and tier gating.

## 2. Locked decisions

| Decision | Choice |
| --- | --- |
| Public URL namespace | **`ishortn.ink/p/[slug]`** (prefixed path — zero collision with the root `[linkAlias]` redirect, simplest routing) |
| Link block model | **Each `link`-type block auto-creates / references a real `link` row** (reuse redirect + analytics pipeline) |
| Block storage | **Relational `BioBlock` table** (not JSON blob) — needed for reorder, per-block tracking, querying |
| Multi-page gating | **Free 1 · Pro ~3 · Ultra unlimited** |
| Branding / custom domain / themes | Pro (follows existing entitlement boundaries) |
| UTM per block | Ultra only (matches existing UTM = Ultra gating) |
| Custom-domain rendering | **Domain root `/` renders the page whose `customDomain` matches host**; `/p/[slug]` stays canonical and also works on the custom domain. Short links on that domain (`/[alias]`) are unchanged. Root route branches on host — no middleware change (middleware already skips `/`). |
| Page views & event quota | **Page views consume `eventsLimit`** (they are tracked events). Over quota: **the page still renders**, the view event is skipped, and analytics shows a "views not tracked this month" notice. Mirrors `recordClick`'s quota behavior (`record-click.ts:109,124`). A view and a click are two legitimate funnel events. |
| Backing-link quota | Each `link`-type block's backing link **counts toward the monthly link quota**, incremented transactionally — same as QR (`qrcode.service.ts:88`). (Follow-up: add a dedicated bio-link allowance if Free's 30-link cap proves tight.) |
| Page QR code | **Encodes the bio page URL directly** (`/p/[slug]` or custom-domain root) — no separate hidden tracking link, so scans are captured by the page-view beacon with no double counting. |
| CTR definition | **Total block clicks ÷ total page views** (primary); also surface unique CTR (unique clicks ÷ unique views). |
| Scope | Full feature end-to-end |

## 3. Architecture overview

```text
Public bio page (HTML, SSG/ISR)          Link block click
  ishortn.ink/p/yourname          ->      ishortn.ink/<alias>  (existing redirect route)
  - renders BioBlocks                       -> /api/link -> recordClick() -> linkVisit
  - page-view beacon -> bioPageView         -> full geo/device/referrer/UTM analytics (reused)
```

- The **public bio page is a real HTML page**, so it cannot reuse the `[linkAlias]` *redirect* route
  — it needs its own route. But the **link blocks within it point to short links that DO redirect**,
  which is how clicks reuse the pipeline.
- **Page views** (the page itself loading) are not clicks, so they need a new lightweight event path
  (`bioPageView` + a beacon). This gives us views + CTR.

### Data model (MySQL, `src/server/db/schema.ts` — match `Link`/`FlaggedLink` conventions)

`BioPage`
- `id` serial PK · `userId` varchar(32) · `teamId` int nullable (workspace scoping)
- `slug` varchar(100) · `title` · `description` text · `avatarUrl` text
- `theme` json (`{ preset, accentColor, buttonStyle, background, font }`)
- `customDomain` varchar(255) nullable · `removeBranding` boolean default false
- `socialPreviewImage` text nullable (Pro custom OG)
- `isPublished` boolean default false · `metadata` json
- `createdAt` · `updatedAt` (onUpdateNow) · `deletedAt` (soft delete)
- Indexes: `userId`, `teamId`, `slug`; **unique** on `slug` (global namespace, DB-enforced)

`BioBlock`
- `id` serial PK · `bioPageId` int notNull
- `type` enum(`link`,`heading`,`text`,`social`,`divider`,`email`)
- `title` · `content` text · `url` text · `linkId` int nullable (FK → `link`, for `type=link`)
- `order` int notNull · `isVisible` boolean default true · `scheduledAt`/`scheduledUntil` (Ultra)
- `createdAt` · `updatedAt`
- Indexes: `bioPageId`, composite `(bioPageId, order)`

`BioPageView` (lightweight page-view events; mirror `linkVisit` shape)
- `id` serial PK · `bioPageId` int notNull
- `country` · `city` · `continent` · `device` · `browser` · `os` · `referer` · `ipHash`
- `createdAt`
- Indexes: `bioPageId`, `createdAt`
- Recording runs `registerEventUsage(ownerId)` first (consumes `eventsLimit`); if not allowed, skip
  the insert but still render the page.

`UniqueBioPageView` (mirror `uniqueLinkVisit`) — `UNIQUE(bioPageId, ipHash)` with
`onDuplicateKeyUpdate` no-op, for unique-visitor counts.

`BioPageViewDailySummary` (mirror `linkVisitDailySummary`) — `(bioPageId, date)` unique, stores
`views` + `uniqueViews`; extend `analytics-cleanup.service.ts` to roll up + prune these alongside
link visits, honoring the same per-plan retention tiers.

Relations + `$inferSelect`/`$inferInsert` type exports per existing pattern. Migration → `0063`
(`bun run db:generate` then `bun run db:migrate`). Latest migration today is `0062`.

### Link-block lifecycle (the key integration)

- Adding a `link` block → create a `link` row with `url`, workspace ownership, and a new
  **`isBioLink` boolean flag** (so bio links don't clutter the main links list, mirroring how
  `isQrCode` hides QR tracking links). Store its `id` as `BioBlock.linkId`.
- Editing the destination → update the `link` row + invalidate its Redis cache key (`domain:alias`).
- Deleting a block / page → soft-delete or remove the backing `link` rows and purge cache.
- Per-block analytics = query `linkVisit`/aggregation for that `linkId` (reuse `getLinkVisits` logic).

## 4. tRPC API (`src/server/api/routers/bio-page/`)

Mirror the `link` router layout: `bio-page.procedure.ts` · `bio-page.service.ts` · `bio-page.input.ts`
· `utils.ts`. Register in `src/server/api/root.ts` as `bioPage`. All procedures are
`workspaceProcedure` (inject workspace + plan), except the public read which is `publicProcedure`.

- `list` / `get` (workspace) — owner's pages
- `create` — plan-gated page-count cap (`checkBioPageLimit`, mirrors `checkWorkspaceLinkLimit`)
- `update` — title/desc/avatar/theme/customDomain/removeBranding (feature gates per field)
- `delete`
- `addBlock` / `updateBlock` / `deleteBlock` — `link` blocks create/update backing `link` rows
- `reorderBlocks` — accepts ordered block ids
- `togglePublished`
- `getBySlug` (**public**) — for the public render route; returns page + visible blocks
- `getAnalytics` (workspace) — page views, total clicks, CTR, per-block breakdown

Limit-exceeded + feature-gate failures throw `TRPCError({ code: "FORBIDDEN", message })`, surfaced
client-side via the existing `notifyPlanLimit` upgrade-prompt path.

### Plan caps (`src/lib/billing/plans.ts` → `PLAN_CAPS`)

Add: `bioPageLimit` (free 1 / pro 3 / ultra undefined=unlimited),
`bioPageCustomThemes`, `bioPageRemoveBranding`, `bioPageCustomDomain` (pro+),
`bioPageUtmPerBlock`, `bioPageScheduling`, `bioPageTeam` (ultra). Add matching marketing copy to
`src/lib/billing/plan-features.ts` (`PLAN_FEATURES`) — backend stays source of truth for copy.

## 5. Tier matrix

| Capability | Free | Pro | Ultra |
| --- | --- | --- | --- |
| Bio pages | 1 | 3 | Unlimited |
| Blocks (link/heading/text/social/divider/email) | All | All | All |
| Per-block click tracking (reused pipeline) | Yes | Yes | Yes |
| Page analytics (views, clicks, CTR) | 7-day window* | Unlimited history + geo/device/referrer | + UTM attribution, advanced |
| Themes | Curated presets | Custom (color/button/background/font) | Custom |
| iShortn branding badge | On | **Removable** | Removed |
| Custom domain | — | Reuse 3-domain cap | Unlimited |
| QR for page | Standard | Branded/dynamic | Branded/dynamic |
| Custom social preview (OG) | Auto-generated | Custom image | Custom |
| UTM per block | — | — | Yes |
| Scheduled blocks | — | — | Yes |
| Team-managed pages / clone page / branded report | — | — | Yes |

\*7-day matches the existing Free analytics cap; already beats Linktree's no-context free tier.

## 6. Builder UI (`src/app/(main)/dashboard/bio-pages/`)

- Add **"Bio Pages"** to `app-sidebar.tsx` `navigationItems` (Tabler icon, e.g. `IconLayoutGrid`).
- Routes: `bio-pages/page.tsx` (list) · `bio-pages/[id]/edit/page.tsx` (builder).
- **Two-pane builder, mobile-first**: editor (left) + live phone-mockup preview (right); on mobile,
  preview-first with editor in a `Drawer`.
- Reuse the existing stack: `react-hook-form` + `zod` + the `Form` wrapper, shadcn primitives
  (`Card`, `Dialog`/`Drawer`, `Tabs`, `Select`, `Switch`, `Popover`, `Input`, `Textarea`), `sonner`
  toasts, tRPC mutation pattern with optimistic updates.
- **Drag-and-drop reorder**: add `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`
  (new dependency — nothing installed today; `react-dropzone`/`framer-motion` exist but aren't DnD).
- **Avatar/image upload**: reuse `uploadImage()` → Cloudflare R2 (`src/server/lib/storage/`); add a
  new `ImageType` for bio assets. Base64 client → R2 server, same as OG image uploader.
- **Theme picker**: presets + accent color (consider lightweight `react-colorful` in a `Popover`),
  button-style + background selectors. Keep bounded — no multi-column, no raw HTML/CSS embeds
  (those are the "website-builder creep" line; staying out also avoids an XSS surface).

## 7. Public page (`src/app/(main)/p/[slug]/page.tsx`)

- Server component, **statically rendered (SSG + on-demand ISR revalidate on publish/edit)** and
  edge/CDN-served — these are high-traffic public pages; ship near-zero client JS (links are `<a>`
  tags, not hydrated components). Target sub-500ms loads (Linktree's biggest weakness).
- `generateMetadata` → per-page title/description/OG (offer custom title/description on Free — a cheap
  wedge vs Linktree which paywalls metadata). Auto-generate an OG image (avatar + name + handle +
  theme color) via `next/og`, versioned/hashed so it busts on edit.
- Renders `BioBlock`s in order; `link` blocks `href` to the short URL so clicks hit the redirect +
  analytics pipeline. The **page-view beacon** runs `recordBioPageView` (bot-filtered, IP-hashed,
  calls `registerEventUsage` first): over quota → the page still renders, the view event is skipped,
  and the dashboard shows a "views not tracked this month" notice.
- Free pages show the "Made with iShortn" badge; Pro/Ultra remove it.
- **Custom domain:** `brand.com/` renders the page whose `customDomain == host` (root route branches
  on host; middleware already skips `/`). `/p/[slug]` stays canonical and also works on the custom
  domain; short links on the same domain (`brand.com/[alias]`) are unchanged.
- The page QR encodes the page URL directly, so scans are captured by the beacon as page views.

## 8. Analytics

- **Page views**: from `BioPageView` + `UniqueBioPageView`, rolled up into `BioPageViewDailySummary`
  by an extended `analytics-cleanup.service.ts` (same per-plan retention tiers as link visits).
- **Block clicks**: from `linkVisit` for each block's backing `linkId`. A single-block drill-down can
  reuse `getLinkVisits`/`aggregateVisits`, but the **page dashboard prefers grouped SQL** (`GROUP BY`
  over the page's link ids) rather than fanning out `getLinkVisits` per block — `link.service.ts:1034`
  loads raw rows and aggregates in memory, which is fine for one link but wasteful across many.
- **Page dashboard**: views, unique views, total clicks, **CTR = total clicks ÷ total page views**
  (plus unique CTR), per-block ranking, top country/referrer/device. Window + dimensions gated by
  plan exactly as link analytics already are.

## 9. Safety, slugs, and edge cases

- **Slug rules**: lowercase, `[a-z0-9_-]`, length-bounded; **DB unique constraint** (not app-level —
  avoids races). **Reserved-words denylist** must exclude every app route (`dashboard`, `api`, `auth`,
  `p`, `blocked`, `expired`, `teams`, `account`, admin terms, brand terms).
- **Abuse**: link-in-bio + shorteners are heavily abused for phishing. Reuse the existing
  creation-time URL scanning (heuristics + blocklist + Safe Browsing + Web Risk + LLM) on bio link
  destinations, the admin moderation / block path, and the public `/abuse` reporting flow. A blocked
  backing link should disable the block.
- **Bot filtering**: page-view beacon and block clicks both run through the existing `isBot()` filter.
- **Cache invalidation**: editing a block's destination must purge the backing link's Redis key.

## 10. New dependencies

- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (block reorder).
- Optional: `react-colorful` (theme color picker) — or a plain input with preview to avoid the dep.

## 11. Integration checklist (acceptance criteria)

This feature touches link creation, hidden tracking links, redirect middleware, analytics retention,
custom domains, billing gates, teams, storage, abuse, and account transfer. These are the integration
surfaces to land — each with an acceptance criterion — so nothing is retrofitted at the UI phase.

**A. `isBioLink` parity with `isQrCode` (every place QR links are special-cased).**
Touch: main link-list filter (`link.service.ts:129`), link counts + analytics-overview filters,
Redis cache schema (`cache/index.ts:59` — add `isBioLink` so it round-trips like `isQrCode`), admin
views where appropriate, transfer logic (item F), and any billing/usage copy referencing link counts.
_Accept:_ a bio page's backing links never appear in the main links list, counts, or non-bio
analytics, and the cache round-trips `isBioLink`.

**B. Transactional hidden-link lifecycle (+ Architecture Opportunity 1).**
Build a shared module `src/server/lib/tracking-link/` first: `createHiddenTrackingLink(tx, ctx, {url,
name, kind: "qr"|"bio"})` (validates via `assertUrlSafe`, enforces + increments the link quota, sets
ownership + `isQrCode`/`isBioLink`, returns `linkId`), `updateHiddenTrackingLink` (updates + purges
Redis), `deleteHiddenTrackingLink` (deletes + purges Redis). Refactor QR's inline logic
(`qrcode.service.ts:113`) onto it; bio uses it mandatorily. `BioBlock` create/update/delete wrap the
backing-link write + `monthlyLinkCount` in ONE `ctx.db.transaction` (the QR pattern).
_Accept:_ a failed `BioBlock` or count write rolls back the backing link — no orphan links, no quota
drift; QR creation still works on the refactored module.

**C. Custom-domain routing contract (decided).**
`brand.com/` → render the bio page whose `customDomain == host` (root route branches on host;
middleware already skips `/`). `/p/[slug]` (platform + custom domain) is canonical. `brand.com/[alias]`
→ short link redirect, unchanged. Domain must be a verified custom domain owned by the workspace; one
primary page per domain (enforce `customDomain` uniqueness on `BioPage`).
_Accept:_ verified-domain root renders the matching page; an unmatched host root falls back to the
landing page; short links on the domain still redirect.

**D. Page-view analytics contract (decided).**
`BioPageView` consumes `eventsLimit` via `registerEventUsage`; over quota → skip the insert, page
still renders, dashboard shows the "views not tracked this month" notice. Unique views via
`UniqueBioPageView`. Retention via `BioPageViewDailySummary` in the extended cleanup service. CTR =
total clicks ÷ total page views (+ unique CTR).
_Accept:_ views record with quota enforcement and skip cleanly when capped; CTR matches the formula;
summaries survive the retention sweep.

**E. QR for the bio page (decided).**
Page QR encodes the bio page URL directly (no hidden tracking link); scans land on the page and are
counted as page views by the beacon.
_Accept:_ scanning the QR increments page views, not a separate link-click metric.

**F. Account transfer + team permissions.**
Add bio pages (+ their backing links + views) to transfer counts/logic
(`account-transfer.service.ts:89`). Add `bio.create | bio.edit | bio.delete` to `WorkspacePermission`
(`workspace/types.ts:12`) and `ROLE_PERMISSIONS` (owner/admin/member). Team-managed pages are
Ultra-only (gate at the cap layer), but the permission entries must exist.
_Accept:_ transferring an account moves bio pages + backing links; team roles enforce bio actions.

**G. Storage type.**
Add `"bio-avatar"` (and `"bio-og"` for custom social preview) to `ImageType` (`storage/types.ts:1`).
_Accept:_ avatar/OG uploads land in R2 under a bio path.

**H. Page-view recorder module (Architecture Opportunity 2).**
`recordBioPageView` mirrors `record-click.ts` — shares bot filtering, UA parsing, IP hashing,
referrer parsing, and `registerEventUsage`. Extract shared helpers rather than copy, so the two
analytics paths cannot drift.
_Accept:_ a bot UA records no view; a human UA records one view + one unique view.

**I. Per-page analytics queries (Architecture Opportunity 3).**
The page dashboard aggregates across many blocks → use grouped SQL (`GROUP BY` over the page's link
ids); reserve `getLinkVisits` (`link.service.ts:1034`) for single-link drill-down.
_Accept:_ page analytics use grouped queries, no per-block in-memory fan-out.

**J. Tests / scripted verification (no test files exist today).**
Add service-level + scripted checks for: slug uniqueness + reserved-words denylist; plan caps (page
count, link count); bio-block create/update/delete lifecycle + transactional rollback; cache
invalidation on destination edit; public page-view recording + over-quota skip; blocked backing link
disables its block; custom-domain root render.

## 12. Execution phases (each ends with a verify gate)

0. **Shared modules** — `tracking-link/` module (refactor QR onto it) + `recordBioPageView` recorder
   (item H). _Verify:_ QR still creates/updates/deletes correctly (regression); recorder unit test
   covers bot-filter + over-quota skip.
1. **Schema + migration** — `BioPage`, `BioBlock`, `BioPageView`, `UniqueBioPageView`,
   `BioPageViewDailySummary`, `isBioLink` flag on `link`, relations, types; generate `0063`.
   _Verify:_ migration applies clean, types infer, cache schema round-trips `isBioLink`.
2. **API layer** — `bioPage` router/service/input + plan caps + register in root; transactional block
   lifecycle (item B); `isBioLink` filter parity (item A). _Verify:_ CRUD + reorder + cap enforcement
   via tRPC; backing links created/updated/cached/excluded from the main list; rollback test passes.
3. **Builder UI** — sidebar entry, list page, two-pane builder, dnd reorder, block editors, avatar
   upload (item G), theme picker. _Verify:_ build a page, reorder, save, round-trip persists.
4. **Public page** — `/p/[slug]` SSG/ISR render, metadata + OG, page-view beacon (item D), custom-
   domain root render (item C), branding badge. _Verify:_ page loads fast, clicks tracked through the
   pipeline, views recorded + quota-skip works, custom-domain root resolves.
5. **Analytics + gating polish** — page analytics dashboard (grouped SQL, item I), tier gates, page QR
   (item E), custom OG. _Verify:_ tier boundaries hold; CTR + unique views match recorded events.
6. **Safety + transfer + launch** — slug denylist, abuse scanning on bio destinations, admin
   moderation wiring, account-transfer + permissions (item F), upgrade prompts. _Verify:_ blocked link
   disables block; reserved slugs rejected; transfer moves bio pages.

## 13. Open follow-ups (not blocking the build)

- Consider a dedicated bio-link allowance if Free's 30-link/month cap proves too tight once each block
  consumes a link.
- Ultra "branded shareable client report" and "clone page" — design later in Phase 5/6.
- Scheduled blocks need a reveal mechanism (render-time check is enough for v1; no cron required).
- Decide final theme preset set with design (DESIGN.md / DESIGN_PRINCIPLES.md as the style anchor).
