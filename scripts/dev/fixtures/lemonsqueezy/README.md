# Lemon Squeezy webhook fixtures

Replay in this order so each event acts on the same subscription row (`data.id` = `900001`):
`subscription_created` -> `subscription_updated` -> `subscription_cancelled` -> `subscription_expired`.

Placeholders substituted by `scripts/dev/webhook.ts` before signing:

- `__USER_ID__` in `meta.custom_data.user_id` (Clerk user id; must exist in `User` or `subscription_created` is dropped)
- `__NOW_ISO__` in `data.attributes.updated_at` (and `created_at` on the created event)

Plan mapping needs no env vars: `variant_id` 1811616 / `product_id` 306137 are hardcoded in
`src/lib/billing/plans.ts` and resolve to pro monthly. The route drops events whose `updated_at` is
not newer than the stored `providerUpdatedAt` (MySQL DATETIME has second precision), so leave at
least one second between replays.
