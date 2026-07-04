# Campaigns — Implementation Plan

Status: **Built end-to-end — typecheck, production build, and 42 tests pass.** Roadmap origin:
Phase 2 of the Product Growth Roadmap (`02 Campaigns.md`). Research inputs: Bitly Campaigns,
Dub/Short.io/Rebrandly grouping, UTM-tool best practices (Terminus/UTM.io/CampaignTrackly), and a
full codebase-surface map (2026-07-03).

**Before this ships:** apply migration `drizzle/0064_wandering_shiva.sql` (`bun run db:migrate`)
— generated but intentionally not applied here.

## 1. What we're building and why

A **Campaign** groups short links and QR codes under one marketing initiative (a launch, event,
flyer run, newsletter push) and answers: *"How did this initiative perform, and which channel won?"*

The container carries **UTM defaults** (Dub/Short.io folder pattern): links created inside a
campaign get `utm_campaign` (from the campaign slug) and any source/medium defaults stamped
automatically. The campaign dashboard aggregates clicks + scans across members with side-by-side
link comparison — the thing no competitor does inside a group.

**Positioning / wedge vs Bitly (their campaigns are $199/mo Premium):**
- Campaigns available on every tier (gate quantity, not existence) — their #1 complaint.
- Rename / archive / delete from day one (Bitly supports none of these).
- Campaign-level device/geo/referrer aggregation (Bitly only aggregates counts by channel).
- QR codes are first-class members with a scans-vs-clicks split (Bitly is links-only).
- User-controlled `utm_medium` (Bitly hardcodes `utm_medium=bitly`, polluting GA data).

## 2. Locked decisions

| Decision | Choice |
| --- | --- |
| Membership model | **`link.campaignId` nullable FK** (folder pattern, one-to-many). A link belongs to ≤1 campaign. QR codes join via their hidden backing link's `campaignId`. No polymorphic join table. |
| Members in v1 | **Links + QR codes** (user decision). Bio pages are a follow-up. |
| UTM defaults tier | **Pro and Ultra** (user decision). Standalone UTM templates stay Ultra-only. Free campaigns = grouping + analytics only. |
| UTM application | **Copy-by-value at link save time** into `link.utmParams` (server-side merge; no redirect hot-path or Redis cache-schema change). User-supplied values win; defaults fill gaps. |
| `utm_campaign` source | Campaign **slug**: auto-derived from name (lowercase, hyphenated), shown editable at create. Silent normalization, never validation errors. |
| Channels | **No channel table in v1.** Channel comparison = group member links by their `utmParams.utm_source` (JS rollup over per-link SQL counts). Bitly-style channel objects can layer on later without schema changes. |
| Lifecycle | User-set `status`: `active` / `archived` only. "Scheduled" / "Ended" are **computed display states** from optional `startDate`/`endDate`. No status soup. |
| Caps | **Free 1 / Pro 2 / Ultra unlimited _active_ campaigns** (archived don't count — archiving frees a slot). `PLAN_CAPS.campaignLimit`, count-rows pattern. Teams = ultra = unlimited. |
| Detail URL | **Slug-based**: `/dashboard/campaigns/[slug]` (slugs are unique per workspace); internal queries/invalidation stay keyed on the numeric id; a slug rename redirects via the `update` mutation's returned slug. |
| Deletes | Hard delete in `ctx.db.transaction`: null member `link.campaignId`, delete campaign row. Links + their analytics survive (Bitly parity). |
| Analytics | **Grouped SQL only** (the `getBioPageAnalytics` pattern) — never the load-raw-rows `getAllUserAnalytics` pattern. Unique visitors = `COUNT(DISTINCT ipHash)` across member linkIds. |

## 3. Data model (`src/server/db/schema.ts`)

`Campaign` (mysqlTable "Campaign")
- `id` serial PK · `userId` varchar(32) notNull · `teamId` int nullable (workspace scoping)
- `name` varchar(100) notNull · `slug` varchar(100) notNull (normalized; default `utm_campaign`)
- `description` text nullable
- `status` mysqlEnum('active','archived') notNull default 'active'
- `startDate` / `endDate` timestamp nullable (display + computed states only)
- `utmSource` / `utmMedium` / `utmTerm` / `utmContent` varchar(255) nullable (defaults; `utm_campaign` comes from `slug`)
- `createdAt` defaultNow · `updatedAt` onUpdateNow
- Indexes: `userId_idx`, `teamId_idx`. Per-workspace duplicate-name check at app layer in a
  transaction (MySQL treats NULL teamId as distinct — folder/tag precedent).

`link` table: add **`campaignId` int nullable + index** (mirrors `folderId`). Add to relations.
**No Redis cache-schema change** — `campaignId` is not read on the redirect hot path.

Migration `0064` via `bun run db:generate`. Relations + `$inferSelect` type exports per convention.

## 4. tRPC API (`src/server/api/routers/campaign/`)

Files: `campaign.input.ts` · `campaign.procedure.ts` · `campaign.service.ts` · `utils.ts`
(+ `utils.test.ts` for pure functions: slug normalization, UTM merge). Register as `campaign` in
`root.ts`. All `workspaceProcedure`; mutations gated with `requirePermission` (bio-page pattern).
New `WorkspacePermission` slugs: `campaigns.create|edit|delete` + `ROLE_PERMISSIONS` entries.

- `list` — campaigns + member counts (links/QR split) + total clicks, batched (no N+1);
  `?status` filter, archived hidden by default
- `get` — campaign + member links (with `isQrCode` flag, per-link click counts)
- `create` — `checkCampaignLimit` (counts **active** only), slug normalize + dedupe
- `update` — rename, description, dates, UTM defaults (**Pro+ gate on UTM fields only**), status
  (archive/unarchive re-checks the cap on unarchive)
- `delete` — transactional cascade (null `link.campaignId`)
- `addLinks` — bulk attach existing links (validate via `workspaceFilter`; exclude `isBioLink`;
  optional `applyUtmDefaults` boolean re-stamps `utmParams`, Pro+)
- `removeLink` — detach (link + analytics survive)
- `analytics` — grouped SQL: totals (clicks, scans, unique visitors via `COUNT(DISTINCT ipHash)`),
  time series by `DATE(createdAt)` split clicks/scans (`isQrCode`), top links w/ share-of-campaign,
  top countries/devices/referrers (groupBy + `ORDER BY count DESC LIMIT N`), previous-period
  growth, channel rollup (JS group by `utmParams.utm_source`). Reuses `rangeEnum`; Free clamped
  via `getPlanCaps(plan).analyticsRangeLimitDays`. `Number(...)` wrap on driver counts.

`link.create`: accepts `campaignId`; when set and plan is Pro+, **server-side merge** of campaign
UTM defaults into `utmParams` (user values win for source/medium/term/content; **`utm_campaign`
always comes from the slug** — it is the campaign's analytics identity, so a link moved between
campaigns can never keep a stale one). This bypasses the client-supplied Ultra-only `utmParams`
gate safely because values originate server-side. `link.update` accepts `campaignId` for
**membership only** — re-stamping is an explicit action via `campaign.addLinks
applyUtmDefaults`, never a side effect of editing a link.

`getLinks` (`link.service.ts`): add `campaignId` filter param (roadmap: filter link list by
campaign). `allAnalyticsSchema` `filterType` gains `'campaign'`.

### Plan caps (`src/lib/billing/plans.ts`)

`campaignLimit?: number` → free `1`, pro `2`, ultra omitted (= unlimited). Helper
`getCampaignLimit(plan)`. `campaignUtmDefaults: boolean` style gate = plan !== 'free' (implement as
a `getPlanCaps` field, consistent with existing caps). `checkCampaignLimit(ctx)` util mirrors
`checkBioPageLimit`, counting `status = 'active'` rows via `workspaceFilter`, `TRPCError FORBIDDEN`
with upgrade message. Client cap-hit → `notifyPlanLimit(msg, "campaign_create")`.

Copy: `PLAN_FEATURES` in `src/lib/billing/plan-features.ts` — "1 campaign" / "2 active campaigns +
campaign UTM defaults" / "Unlimited campaigns" (counts interpolate from `PLAN_CAPS`).

## 5. Tier matrix

| Capability | Free | Pro | Ultra |
| --- | --- | --- | --- |
| Active campaigns | 1 | 2 | Unlimited |
| Assign links + QR codes, rename/archive/delete | Yes | Yes | Yes |
| Aggregate analytics (clicks, scans, uniques, geo/device/referrer, top links) | 7-day window | Full history | Full history |
| Campaign UTM defaults (auto-stamp on create/attach) | — | Yes | Yes |
| CSV export (links + stats) | — | Yes | Yes |
| Team campaigns | — | — | Yes (teams are ultra) |

Upgrade moments: Free creating 2nd campaign → Pro; Pro at 2 active → Ultra; Free touching UTM
defaults section → Pro (PlanBadge + disabled controls, existing pattern).

## 6. Dashboard UI (`src/app/(main)/dashboard/campaigns/`)

Load `make-interfaces-feel-better` + repo design conventions before building. Match the mapped
vocabulary exactly: divide-y stacked rows w/ framer-motion stagger, `text-[13px]` body, blue-600
primary, explicit `dark:` twins, @tabler icons, `next-view-transitions` Link, DialogBody in dialogs.

- **Sidebar**: "Campaigns" + `IconSpeakerphone` (IconTarget is taken by UTM Templates).
- **List** `campaigns/page.tsx` (server, `force-dynamic`, fetches list + subscriptions) →
  `_components/campaigns-list.tsx`. Row: icon circle · name + status Badge (Active emerald /
  Scheduled blue / Ended amber / Archived neutral — computed states rendered as display-only) ·
  meta line "5 links · 2 QR codes · 1.2k clicks · Jun 1 – Jul 15" · hover actions (open, archive,
  delete). Cap-reached → disabled span + tooltip (existing pattern). Empty state: dashed rounded-xl,
  explains campaigns in one sentence, CTA.
- **Create dialog** (not a page): Name → live slug preview ("utm_campaign: `summer-launch`",
  editable, silently normalized) → optional description/dates. UTM defaults live in the detail
  page's Settings tab, not the create dialog — keep create ≤10s. On success: toast + `router.push`
  to the new campaign (bio-pages convention).
- **Detail** `campaigns/[id]/page.tsx` — the "workspace" feel from the roadmap. Back-arrow header,
  name, status badge, date range; actions: **Add links** (primary), Export CSV, overflow (edit,
  archive, delete w/ AlertDialog). Tabs: **Overview / Links / Settings**.
  - *Overview*: stat row (`QuickInfoCard` grid: Total clicks · QR scans · Unique visitors ·
    Best channel) with previous-period growth pills → time-series chart (clicks vs scans series,
    existing recharts ChartContainer) → **top links ranked with share-of-campaign %** (bar-list) →
    countries/devices/referrers bar-lists. Free sees 7-day window + existing upgrade banner.
  - *Links*: member rows (short link, destination, channel chip from `utm_source`, clicks/scans,
    remove). "Add links" opens a dialog: searchable multi-select of existing links (excludes
    QR-backing/bio links; QR codes listed in their own group) + "Apply campaign UTM defaults"
    checkbox (Pro+). "Create link" deep-links to `/dashboard/links/new?campaignId=X`.
  - *Settings*: name/slug/description/dates, **UTM defaults** section (source/medium/term/content
    + read-only `utm_campaign` = slug; GA4-recognized medium suggestions; Pro+ else PlanBadge +
    disabled), archive/delete danger zone.
- **Link form** (`links/new` + edit): Campaign `Select` (with `?campaignId` prefill); when a
  campaign with defaults is selected, show stamped params as muted prefilled chips — visually
  distinct so inheritance is obvious. Free/Pro can't hand-edit `utmParams` (still Ultra) but see
  what the campaign will stamp (Pro+) or an upgrade hint (Free).
- **Links list**: campaign filter (URL searchParams, like folder/tag) + "Add to campaign" in the
  link row overflow menu (both attach directions — Bitly lesson).
- **CSV export**: client-side generation from the analytics payload (campaign, per-link short URL,
  destination, channel, clicks, scans). Pro+.

## 7. Integration checklist (acceptance criteria)

**A. Workspace + folder-access parity.** All queries `workspaceFilter`; campaign link lists and
analytics apply the non-admin folder-access filter (`getAccessibleFolderIds`) so campaigns can't
leak folder-restricted links. _Accept:_ a member without folder access never sees restricted links
via a campaign.

**B. Hidden-link hygiene.** Campaign link pickers/lists exclude `isBioLink` always; QR-backing
links (`isQrCode`) appear only as their QR code, never as plain links; campaign analytics
deliberately include them as scans. _Accept:_ no hidden backing link is directly attachable; scans
and clicks are split correctly.

**C. Team cleanup.** `team-cleanup.service.ts` deletes campaigns by `teamId` (and nulls member
`campaignId`). _Accept:_ deleting a team leaves no orphan campaign rows or dangling FKs.

**D. Cross-workspace link transfer.** Link transfer resets `campaignId` to null (folder/tag
precedent) with a validation note. _Accept:_ transferred links carry no foreign campaign membership.

**E. Account transfer.** Transfer personal-workspace campaigns with their membership, and block
transfers that would exceed the target's active-campaign cap (bio-pages precedent: validate
without a snapshot column — no `campaignsCount` on `accountTransfer`). _Accept:_ transfer moves
campaigns; over-cap transfers are rejected at validation.

**F. UTM merge correctness.** Server-side merge: explicit user params win; campaign defaults fill
gaps; `utm_campaign` from slug; silent normalization (lowercase/trim); destination URLs that
already carry query params are merged not double-appended (existing `appendUtmParams` behavior —
verify, don't duplicate). _Accept:_ unit tests cover merge precedence + normalization.

**G. Gating.** Create cap counts active only; unarchive re-checks cap; UTM default writes rejected
for Free server-side; `notifyPlanLimit` fires with source `campaign_create`. _Accept:_ boundaries
hold at the API regardless of UI state.

**H. Plan copy.** `PLAN_FEATURES` updated (single source for landing + dashboard pricing).
_Accept:_ pricing surfaces show campaign entitlements without hardcoded drift.

## 8. Execution phases (each ends with a verify gate)

0. **Schema + caps + permissions** — Campaign table, `link.campaignId`, migration `0064`,
   `PLAN_CAPS.campaignLimit` + helpers, permission slugs. _Verify:_ migration generates clean,
   typecheck passes.
1. **API layer** — router/service/input/utils + `checkCampaignLimit` + analytics grouped SQL +
   `link.create/update` campaignId + UTM stamping + `getLinks` campaign filter. _Verify:_ typecheck;
   utils unit tests (slug, merge) pass.
2. **Dashboard UI** — sidebar, list, create dialog, detail (Overview/Links/Settings), link-form
   campaign select, links-list filter + add-to-campaign. _Verify:_ `next build`; manual flow:
   create → add links → see analytics → archive.
3. **Integration surfaces + polish** — team cleanup, transfers, plan copy, upgrade prompts, CSV
   export. _Verify:_ checklist items A–H.
4. **Review** — multi-agent adversarial review workflow over the full diff; fix confirmed findings.

## 9. Deferred follow-ups (explicitly not v1)

- Bio pages as campaign members (user decision: later).
- Bitly-style channel objects + one-short-link-per-channel auto-generation (killer feature, big
  scope; the `utm_source` rollup keeps the door open).
- Shareable/branded campaign reports (Phase 3 of the roadmap), scheduled reports, conversions,
  revenue, compare-campaigns-by-period, clone campaign (Ultra, roadmap).
- CSV bulk import into a campaign.
- Sidebar usage stats for campaigns (subscriptions payload).

From the post-build review (confirmed, deliberately deferred):

- Account transfer can produce duplicate campaign names/slugs in the target workspace (no DB
  unique constraint; `assertNoDuplicate` is app-layer). De-dupe with a suffix during Phase 7c.
- `getAllUserAnalytics` applies no folder-access restriction for ANY filter type (pre-existing
  gap; the new `campaign` filter matches existing folder/link filter behavior). Fixing it should
  cover all filter types at once.
- `campaign.get` returns the full member list unpaginated and the analytics per-link breakdown is
  uncapped. Fine at expected sizes (Bitly caps 100 links/campaign); paginate the Links tab via
  the `link.list` campaignId filter if campaigns grow past that.
- Team-deletion cleanup misses bio pages (pre-existing gap noticed while adding campaign cleanup
  — `team-cleanup.service.ts` has no bioPage deletion).
