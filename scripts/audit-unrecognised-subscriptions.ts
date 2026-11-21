/**
 * Lists Subscription rows with no recognised plan (variantId = 0 AND productId = 0)
 * next to their current Lemon Squeezy state, so they can be corrected.
 *
 * Usage (from repo root):
 *   set -a; source .env.production.local; set +a
 *   bun scripts/audit-unrecognised-subscriptions.ts           # dry run, writes nothing
 *   bun scripts/audit-unrecognised-subscriptions.ts --apply   # copy provider state onto rows found on Lemon Squeezy
 *
 * --apply only updates rows whose subscription exists on Lemon Squeezy, and
 * only with the provider's own state. Rows without a provider subscription are
 * reported and left alone: resolvePlan() already treats them as Free.
 */
import { getSubscription, lemonSqueezySetup } from "@lemonsqueezy/lemonsqueezy.js";
import mysql from "mysql2/promise";

import { getIntervalFromVariantId, getPlanFromIds } from "../src/lib/billing/plans";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

type Row = {
  userId: string;
  subscriptionId: number | null;
  status: string | null;
  plan: string | null;
  renewsAt: Date | null;
  endsAt: Date | null;
};

const apply = process.argv.includes("--apply");

lemonSqueezySetup({ apiKey: required("LEMONSQUEEZY_API_KEY") });
const conn = await mysql.createConnection(required("DATABASE_URL"));

const [result] = await conn.query(
  "SELECT userId, subscriptionId, status, plan, renewsAt, endsAt FROM Subscription WHERE variantId = 0 AND productId = 0",
);
// SAFETY: the SELECT above names exactly the columns in Row.
const rows = result as Row[];

console.info(
  `${rows.length} row(s) with variantId = 0 AND productId = 0${apply ? "" : " (dry run)"}\n`,
);

for (const row of rows) {
  const local = `local: status=${row.status} plan=${row.plan} renewsAt=${row.renewsAt?.toISOString() ?? "-"} endsAt=${row.endsAt?.toISOString() ?? "-"}`;

  if (!row.subscriptionId || row.subscriptionId <= 0) {
    console.info(`${row.userId}\n  ${local}\n  provider: no subscription id; resolves to free\n`);
    continue;
  }

  const remote = await getSubscription(row.subscriptionId);
  if (remote.error) {
    console.info(
      `${row.userId}\n  ${local}\n  provider: subscription ${row.subscriptionId} lookup failed (${remote.statusCode ?? "?"}: ${remote.error.message}); resolves to free\n`,
    );
    continue;
  }

  const attrs = remote.data.data.attributes;
  const plan = getPlanFromIds(attrs.variant_id, attrs.product_id);
  console.info(
    `${row.userId}\n  ${local}\n  provider: status=${attrs.status} variant=${attrs.variant_id} product=${attrs.product_id} plan=${plan ?? "unrecognised"} renews_at=${attrs.renews_at ?? "-"} ends_at=${attrs.ends_at ?? "-"}`,
  );

  if (!apply) {
    console.info("");
    continue;
  }

  // The webhook ordering marker is set too, so a late older event can't undo this.
  await conn.execute(
    "UPDATE Subscription SET status = ?, plan = ?, billingInterval = ?, variantId = ?, productId = ?, renewsAt = ?, endsAt = ?, providerUpdatedAt = ? WHERE userId = ? AND subscriptionId = ?",
    [
      attrs.status,
      attrs.status === "expired" ? "free" : (plan ?? row.plan ?? "free"),
      getIntervalFromVariantId(attrs.variant_id),
      attrs.variant_id,
      attrs.product_id,
      attrs.renews_at ? new Date(attrs.renews_at) : null,
      attrs.ends_at ? new Date(attrs.ends_at) : null,
      new Date(attrs.updated_at),
      row.userId,
      row.subscriptionId,
    ],
  );
  console.info("  applied provider state\n");
}

await conn.end();
