## Event Cap Implementation Progress

### Completed
- Added schema support: `Subscription.plan/productId/variantId` and `User.monthlyEventCount/lastEventCountReset/eventUsageAlertLevel` (migration `0027_bold_event_caps.sql`).
- Introduced plan mapping + caps helper (`src/lib/billing/plans.ts`) and reusable user plan context utilities (`src/server/lib/user-plan.ts`).
- Added event usage guard with monthly reset + alert threshold tracking (`src/server/lib/event-usage.ts`).
- Wired analytics enforcement: middleware click logging now consults event caps, skips analytics when capped, and triggers 80/90/100% alerts via Resend (`src/middlewares/record-click.ts`, `src/server/lib/notifications/event-usage.ts`, email template `src/emails/event-usage-alert.tsx`). Shared guard also applied to `logAnalytics`.
- Updated Lemon Squeezy webhook handling to persist plan/product/variant ids and set plan to `free` on cancel/expire.
- Applied new plan caps: link creation now respects Free 30/mo, Pro 2,000/mo, Ultra unlimited; folder creation enforces Free=0, Pro=3, Ultra=unlimited with clearer errors.

### Upcoming
- Expose plan + usage (events/links/folders) through TRPC and dashboard UI, including usage meters and upgrade prompts.
- Add resilience: dedupe alert sends across processes (idempotency key) and consider a lightweight queue/backoff to reduce email spam risk.
- Optional: reset/link/event counters on plan downgrades, and add monitoring/logging around capped analytics drops.

### Latest changes (this pass)
- Subscriptions TRPC now returns plan, caps, and usage for events/links/folders (with normalized monthly counters).
- Sidebar UI shows link + event usage meters and folder limits; plan-aware limits and upgrade prompts are visible in navigation/sidebar components.
