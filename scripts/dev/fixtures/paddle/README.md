# Paddle webhook fixtures

The route answers 404 until Paddle is configured: set the `PADDLE_*` block in `.env` (sandbox keys,
the webhook secret and the four price IDs; see `.env.example`).

Replay in this order so each event acts on the same subscription row (`data.id` =
`sub_01dev000000000000000000000`):
`subscription.created` -> `subscription.updated` (schedules a cancel at the period end) ->
`subscription.past_due` -> `subscription.canceled`.

Placeholders substituted by `scripts/dev/webhook.ts` before signing:

- `__USER_ID__` in `data.custom_data.user_id` (Clerk user id; must exist in `User` or
  `subscription.created` is dropped)
- `__NOW_ISO__` in `occurred_at` and `data.updated_at` (and `data.canceled_at` on the canceled event)
- `__PADDLE_PRICE_PRO_MONTHLY__` in the item's price id, from `PADDLE_PRICE_PRO_MONTHLY` in `.env`

The script signs with `PADDLE_WEBHOOK_SECRET` in Paddle's `ts=<unix seconds>;h1=<hmac>` format.
The route rejects a `ts` more than 5 seconds off, and drops events whose `updated_at` is not newer
than the stored `providerUpdatedAt` (MySQL DATETIME has second precision), so leave at least one
second between replays.
