## Event Cap Implementation Plan

### What exists today
- Click events are recorded via `src/middleware.ts` → `/api/link` → `recordUserClickForLink` (`src/middlewares/record-click.ts`), which writes to `LinkVisit` and `UniqueLinkVisit`. There is no usage cap here; redirects always proceed.
- Plan detection is binary: checks if a `Subscription` row exists with `status === "active"` to unlock “Pro.” `Subscription` stores status/card data only—no plan/variant id—so there is no way to distinguish future plans.
- Usage tracking only covers link creation (`User.monthlyLinkCount`/`lastLinkCountReset`). No event/month counters exist.

### Target behavior
- Monthly event caps: Free → 1k, Pro → 10k, Ultra → unlimited.
- Email alerts at 80% and 90% of the event cap, and at 100% when analytics recording stops until upgrade.
- Free links/month: keep current 30. Pro links/month: cap at 2,000. Ultra links/month: unlimited.
- Folder limits: Free → 0 folders, Pro → max 3 folders, Ultra → unlimited.
- When a user is out of events, keep redirecting but stop recording analytics and surface clear UI messaging + upgrade paths.
- Ultra plan should be identifiable from Lemon Squeezy variant/product metadata and treated as uncapped.

### Plan
1. **Persist plan & usage metadata**
   - Add `plan` (enum: free/pro/ultra), `variantId`, and optional `productId` columns to `Subscription`.
   - Add `monthlyEventCount` and `lastEventCountReset` to `User` (mirroring link count fields).
   - Add `monthlyLinkCountLimit` (or derive from plan), and optionally `monthlyLinkCount` reuse to enforce Pro’s 2,000/month cap, Ultra unlimited, Free 30.
   - Add `folderLimit` derivable from plan (Free=0, Pro=3, Ultra=unlimited) or compute via helper.
   - Create Drizzle migration + type exports; backfill existing subscriptions as `pro` using the current `LEMONSQUEEZY_VARIANT_ID`.

2. **Centralize plan resolution**
   - Introduce a helper (e.g., `src/lib/billing/plans.ts`) that maps product/variant ids → plan enum and exposes caps (`eventsLimit`, `linksLimit`, `folderLimit`, `analyticsRangeLimit`). Current Lemon Squeezy ids to encode: Pro product/variant `441105` (sample payloads show `variant_id: 441105`, `product_id: 306137`—confirm which is authoritative for production); Ultra product/variant `1108002`.
   - Update webhook handler (`src/app/api/webhooks/lemonsqueezy/route.ts`) to store plan + variant/product ids on create/update using `attributes.variant_id`/`attributes.product_id` and `event_name`.
   - Add a small utility (`getUserPlanWithCaps(userId)`) that returns `{ plan, eventsLimit, isUnlimitedEvents }` with caching (Redis) to avoid per-click db hits.

3. **Enforce caps at write time**
   - Wrap event writes in `recordUserClickForLink` with a guard:
     - Reset `monthlyEventCount` when `lastEventCountReset` is before month start (same pattern as link counts).
     - If `eventsLimit` is finite and `monthlyEventCount >= limit`, skip inserting `LinkVisit`/`UniqueLinkVisit` and mark the request as capped (for telemetry/UX and email trigger).
     - Otherwise insert visits and increment `monthlyEventCount` in `User`.
   - Reuse the same guard in any other analytics writer (`logAnalytics` in `src/server/api/routers/link/utils.ts`) to keep behavior consistent.
   - Enforce plan-based link creation caps: Free 30/month (existing), Pro 2,000/month, Ultra unlimited. Reset monthly counts monthly as done today.
   - Enforce plan-based folder creation caps: Free hard cap 0, Pro hard cap 3, Ultra unlimited.

4. **Surface usage in product/UI**
   - Extend TRPC subscription lookup to include `{ plan, eventsLimit, monthlyEventCount, linksLimit, folderLimit }`.
   - Add a dashboard component (parallel to `MonthlyUsage`) that shows event usage for Free/Pro and an “unlimited” state for Ultra; show upgrade prompts when near/at limit.
   - Add folder usage UI for Pro (3 cap) and link usage UI for Pro (2,000 cap) + Free (30 cap).
   - When a cap is hit during redirect, optionally set a response header/flag to inform client dashboards or server logs without altering the redirect.
   - Trigger emails at 80%/90%/100% of event cap; use a debounced/once-per-threshold mechanism and idempotency keys in a new email queue/table (or resend directly with a last-sent marker on `User`).

5. **Operational safeguards**
   - Provide a one-off script to backfill `plan` and zero `monthlyEventCount` for existing users.
   - Add monitoring/logging around capped events and email sends to ensure we don’t silently drop traffic or spam users; store last-threshold-sent to prevent duplicate emails.
   - Update documentation/env samples for `LEMONSQUEEZY_VARIANT_ID_ULTRA` (and product ids if needed) and note the monthly reset semantics and Pro folder/link caps.

### Open questions to align on
- Should capped users still accumulate unique visits (for dedupe) or skip all writes? (Plan assumes skip all writes.)
- Do we want a grace buffer beyond 100% (e.g., temporary overage window) or hard stop at cap?
- Confirm authoritative Lemon Squeezy ids: samples include `variant_id: 441105`, `product_id: 306137` for Pro; requested ids are product/variant `441105` (Pro) and `1108002` (Ultra).

### Notes from sample webhook payloads
- `event_name` values to handle: `subscription_created`, `subscription_updated`, `subscription_expired`, `subscription_cancelled`.
- Relevant fields for plan resolution are in `data.attributes`: `product_id`, `variant_id`, `status`, `ends_at`, `renews_at`, `card_brand`, `card_last_four`.
- `custom_data.user_id` carries the Clerk user id to associate the subscription row.
