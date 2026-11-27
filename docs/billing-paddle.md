# Paddle billing

Lemon Squeezy is the default payment provider. Paddle Billing is integrated next to it and stays
inert until it is fully configured: with any required variable missing, or with keys that don't
match `PADDLE_ENVIRONMENT`, `getPaddleConfig()` returns `null`, `/api/webhooks/paddle` answers 404,
`/dashboard/checkout` redirects to pricing and every checkout goes to Lemon Squeezy.

Code: `src/lib/paddle/` (config, API client, webhook signature, subscription normalizer),
`src/app/api/webhooks/paddle/`, `src/app/(main)/dashboard/checkout/`, and the provider-aware
helpers in `src/lib/billing/plans.ts`.

## Environment variables

Set in `.env` locally and as Worker secrets in production (`.env.example` has the block).

| Variable                          | Required | What it does                                                                                                                                                        |
| --------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PADDLE_ENVIRONMENT`              | no       | `sandbox` (default) or `production`. Picks the API host (`sandbox-api.paddle.com` / `api.paddle.com`) and the Paddle.js environment.                                |
| `PADDLE_API_KEY`                  | yes      | Server API key. Must start with `pdl_sdbx_` (sandbox) or `pdl_live_` (production). Used for customers, transactions, subscriptions and discounts.                  |
| `PADDLE_WEBHOOK_SECRET`           | yes      | Secret key of the notification destination. Verifies the `Paddle-Signature` header on `/api/webhooks/paddle`.                                                     |
| `PADDLE_CLIENT_TOKEN`             | yes      | Client-side token for Paddle.js on `/dashboard/checkout`. Must start with `test_` (sandbox) or `live_` (production). Read on the server per request, not inlined. |
| `PADDLE_PRICE_PRO_MONTHLY`        | yes      | Price id (`pri_…`) for Pro monthly.                                                                                                                                 |
| `PADDLE_PRICE_PRO_ANNUAL`         | yes      | Price id for Pro annual.                                                                                                                                            |
| `PADDLE_PRICE_ULTRA_MONTHLY`      | yes      | Price id for Ultra monthly.                                                                                                                                         |
| `PADDLE_PRICE_ULTRA_ANNUAL`       | yes      | Price id for Ultra annual.                                                                                                                                          |
| `PADDLE_PRICE_PRO_LEGACY_MONTHLY` | no       | Older Pro monthly price. Recognised in webhooks as Pro monthly; never offered at checkout.                                                                         |
| `BILLING_PROVIDER`                | no       | `lemonsqueezy` (default) or `paddle`. Which provider new checkouts use; see below.                                                                                  |
| `PADDLE_CHECKOUT_USER_IDS`        | no       | Comma-separated Clerk user ids that check out with Paddle while `BILLING_PROVIDER` is `lemonsqueezy`.                                                              |

## Which provider a user gets

- **New checkouts** (a user with no subscription that still grants access) go to Paddle only when
  Paddle is configured and either `BILLING_PROVIDER=paddle` or the user's id is in
  `PADDLE_CHECKOUT_USER_IDS`. Everyone else gets a Lemon Squeezy checkout
  (`checkoutProviderFor` in `src/lib/paddle/config.ts`).
- **Existing subscriptions are always managed by the provider stored on their row**
  (`subscription.billingProvider`), whatever the switch says. A Lemon Squeezy subscriber stays on
  Lemon Squeezy after `BILLING_PROVIDER` flips to `paddle`, and a Paddle subscriber stays on Paddle
  if it flips back. Only a user whose subscription has ended goes through the switch again.
- Lemon Squeezy rows are keyed by `subscriptionId`; Paddle rows keep `subscriptionId = 0` and are
  keyed by `providerSubscriptionId` (`sub_…`) and `providerCustomerId` (`ctm_…`).
- Background checks follow the row too: the daily reconcile (`syncProviderEndedSubscriptions`), the
  card-update email check (`paymentUpdateEmailAllowed`) and account deletion ask Paddle about
  Paddle rows and Lemon Squeezy about Lemon Squeezy rows. If Paddle isn't configured, Paddle rows
  are skipped with a warning.

## Paddle setup

Do this once per environment (sandbox first, then live). In the Paddle dashboard:

1. **Products and prices** (Catalog → Products): create a Pro and an Ultra product, each with a
   monthly and an annual recurring price in USD that match the pricing page. On every price, set
   the quantity to minimum 1 and maximum 1: Paddle's default allows up to 100, which lets a
   customer buy several seats at checkout. Copy the four price ids into the `PADDLE_PRICE_*`
   variables. Set `PADDLE_PRICE_PRO_LEGACY_MONTHLY` only if an older
   Pro price has live subscriptions.
2. **Client-side token** (Developer tools → Authentication → Client-side tokens): create one and set
   it as `PADDLE_CLIENT_TOKEN`.
3. **API key** (Developer tools → Authentication → API keys): create a key with read and write
   access to customers, transactions, subscriptions, discounts and customer portal sessions; set
   it as `PADDLE_API_KEY`.
4. **Default payment link** (Checkout → Checkout settings): `https://<app host>/dashboard/checkout`.
   Paddle opens server-created transactions there with `?_ptxn=txn_…` (new checkouts and
   payment-method updates, including links in Paddle's own emails). The link must be `https`
   (`http://localhost:3000` is rejected with an SSL error; see "Local testing" for a tunnel), and
   the domain must be approved in Paddle before it can be used.
5. **Notification destination** (Developer tools → Notifications): URL
   `https://<app host>/api/webhooks/paddle`, type webhook, with these events:
   - `subscription.created`, `subscription.imported`, `subscription.updated`,
     `subscription.activated`, `subscription.trialing`, `subscription.past_due`,
     `subscription.paused`, `subscription.resumed`, `subscription.canceled`
   - `transaction.completed` (first payment: card details on the row and the `order_completed`
     analytics event)

   Copy the destination's secret key into `PADDLE_WEBHOOK_SECRET`.
6. **Discounts** (Catalog → Discounts): promo codes typed at checkout are looked up as active
   discount codes; create the same codes as on Lemon Squeezy if they should work on Paddle too.

Paddle turns on only when the API key, webhook secret, client token and the four sellable prices
are all set and their prefixes match `PADDLE_ENVIRONMENT`. A mismatch logs
`Paddle API key or client token does not match PADDLE_ENVIRONMENT; Paddle disabled`.

## Local testing

1. Create a [sandbox account](https://sandbox-login.paddle.com/signup).
2. Start the dev server (`bun dev`) and, in a second terminal, an https tunnel to it:

   ```bash
   bun run tunnel   # cloudflared tunnel --url http://localhost:3000
   ```

   It prints a `https://<random>.trycloudflare.com` URL. Paddle needs this because the default
   payment link must be `https`. A quick tunnel gets a new hostname every time it starts, so
   update the payment link and notification destination below whenever it changes.
3. Let the dev server accept requests from the tunnel host. Next.js blocks cross-origin requests
   to dev assets, and without this the page loads but sign-in never appears. Add this to the
   `config` object in `next.config.js` (local only, don't commit it) and restart `bun dev`:

   ```js
   allowedDevOrigins: ["*.trycloudflare.com"],
   ```

4. Do the [setup above](#paddle-setup) in the sandbox account with the tunnel URL as the app host:
   default payment link `<tunnel URL>/dashboard/checkout` and notification destination
   `<tunnel URL>/api/webhooks/paddle`.
5. Fill the `PADDLE_*` block in `.env` with the sandbox values, leave `BILLING_PROVIDER` unset and
   put your local Clerk user id in `PADDLE_CHECKOUT_USER_IDS`. Restart `bun dev`, then open the app
   through the tunnel URL (not `localhost`) to check out.

   Checkouts created by the app show up in Paddle (Transactions) with `origin: api`, not `web`:
   the server creates the transaction through the API and Paddle.js opens it from `?_ptxn=`.
   That is expected.

6. Real sandbox events reach `/api/webhooks/paddle` through the tunnel. Paddle's notification
   simulator (Developer tools → Simulations) can also send single events to it.
7. To test webhook handling without Paddle, replay signed fixtures against the local app:

   ```bash
   bun run webhook paddle subscription.created --user <clerkUserId>
   bun run webhook paddle transaction.completed --user <clerkUserId>
   bun run webhook paddle subscription.updated --user <clerkUserId>
   bun run webhook paddle subscription.past_due --user <clerkUserId>
   bun run webhook paddle subscription.canceled --user <clerkUserId>
   ```

   The fixtures live in `scripts/dev/fixtures/paddle/` (its README explains the order and the
   placeholders). Leave a second between replays: events not newer than the stored
   `providerUpdatedAt` are dropped as stale.

8. Run the daily reconcile by hand:

   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/entitlements
   ```

Sandbox cards: `4242 4242 4242 4242` succeeds, `4000 0000 0000 0002` is declined, and
`4000 0027 6000 3184` asks for 3-D Secure; any future expiry and any CVC.

## Sandbox test cases

In-app plan changes, cancel, resume, pause and portal links are not routed to Paddle yet; manage
sandbox subscriptions from the Paddle dashboard (Customers → Subscriptions) for these cases.

Run these against the sandbox before switching any traffic. For each, check the user's
`Subscription` row (`billingProvider`, `providerSubscriptionId`, `status`, `plan`,
`billingInterval`, `endsAt`, card fields) and the plan shown in the dashboard.

| #   | Case                                                                  | Expected                                                                                                                                                       |
| --- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | User in `PADDLE_CHECKOUT_USER_IDS` buys Pro monthly with `4242…`      | Pricing opens `/dashboard/checkout?_ptxn=…` with the Paddle overlay; after paying, the row is `paddle`, `active`, `pro`, `monthly`, card Visa 4242.              |
| 2   | Same for Ultra annual                                                 | Row is `ultra`, `annual`; Ultra features unlock.                                                                                                              |
| 3   | Checkout with an active Paddle discount code                          | The overlay shows the discount line.                                                                                                                           |
| 4   | Checkout with an unknown code                                         | Checkout still opens, without a discount.                                                                                                                      |
| 5   | User not in the list (switch on `lemonsqueezy`)                       | Checkout goes to Lemon Squeezy as before.                                                                                                                      |
| 6   | Declined card (`4000 0000 0000 0002`) at checkout                     | Paddle shows the error; no subscription row is written.                                                                                                       |
| 7   | Cancel at period end in the Paddle dashboard                          | `subscription.updated` sets `status=cancelled` with `endsAt` at the period end; the plan stays until then.                                                    |
| 8   | Cancel immediately in the Paddle dashboard                            | `subscription.canceled` sets `status=expired`, `plan=free`; the lapse grace period and its email start.                                                       |
| 9   | Failed renewal (simulate `subscription.past_due`)                     | `status=past_due`; the reconcile checks the row with Paddle, which still reports it retrying, so the card-update email goes out.                             |
| 10  | Missed webhook: pause the notification destination, cancel immediately, run the reconcile | The reconcile reads the subscription from Paddle and syncs the row to `expired` / `free`; the log shows `synced subscription ended at provider`. |
| 11  | Card-update email for a subscription Paddle already canceled          | The hourly email run skips the email and syncs the row instead.                                                                                               |
| 12  | Delete the account (Settings, Delete account) with a live Paddle subscription | The subscription is canceled immediately in Paddle, the row reads `expired`, and the account is soft-deleted.                                        |
| 13  | Delete the account while Paddle refuses the cancel and the subscription is still live (for example a wrong API key) | Deletion is refused with "We couldn't cancel your subscription…" and nothing is deleted. |
| 14  | Replay any webhook with a bad signature or a `ts` older than 5 seconds | 401; nothing changes.                                                                                                                                          |
| 15  | Lemon Squeezy subscriber with `BILLING_PROVIDER=paddle`              | Billing, reconcile and deletion keep using Lemon Squeezy for that row.                                                                                         |

## Going live

1. Repeat the setup in the live Paddle account and set the live values with
   `PADDLE_ENVIRONMENT=production`.
2. Start with a few internal accounts in `PADDLE_CHECKOUT_USER_IDS` and run cases 1, 7, 8 and 12
   with a real card (refund afterwards).
3. Set `BILLING_PROVIDER=paddle` to send every new checkout to Paddle. Existing Lemon Squeezy
   subscribers are unaffected (see "Which provider a user gets").
