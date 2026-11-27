import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";

import WebhookDisabledEmail from "@/emails/webhook-disabled";
import { getAppUrl } from "@/lib/constants/domains";
import { team, user, webhook, webhookDelivery } from "@/server/db/schema";
import { WEBHOOK_DISABLE_AFTER } from "@/server/lib/webhooks/delivery";

import { EMAIL_FROM_SYSTEM, sendEmail } from "./send-email";

import type { db as appDb } from "@/server/db";

/** Tells the workspace owner (the team owner for a team endpoint) that failures disabled it. */
export async function sendWebhookDisabledEmail(db: typeof appDb, webhookId: number) {
  const teamOwner = alias(user, "teamOwner");
  const [[row], [lastDelivery]] = await Promise.all([
    db
      .select({
        url: webhook.url,
        teamName: team.name,
        teamSlug: team.slug,
        ownerId: user.id,
        ownerEmail: user.email,
        ownerName: user.name,
        teamOwnerId: teamOwner.id,
        teamOwnerEmail: teamOwner.email,
        teamOwnerName: teamOwner.name,
      })
      .from(webhook)
      .leftJoin(team, eq(webhook.teamId, team.id))
      .leftJoin(user, eq(webhook.userId, user.id))
      .leftJoin(teamOwner, eq(team.ownerId, teamOwner.id))
      .where(eq(webhook.id, webhookId))
      .limit(1),
    db
      .select({ error: webhookDelivery.error })
      .from(webhookDelivery)
      .where(eq(webhookDelivery.webhookId, webhookId))
      .orderBy(desc(webhookDelivery.lastAttemptAt))
      .limit(1),
  ]);
  if (!row) return;

  const isTeam = row.teamSlug !== null;
  const recipientId = isTeam ? row.teamOwnerId : row.ownerId;
  const email = isTeam ? row.teamOwnerEmail : row.ownerEmail;
  if (!email) return;

  await sendEmail({
    template: "webhook-disabled",
    from: EMAIL_FROM_SYSTEM,
    recipientId,
    to: email,
    essential: true,
    subject: "A webhook endpoint was disabled after repeated failures",
    react: WebhookDisabledEmail({
      userName: isTeam ? row.teamOwnerName : row.ownerName,
      endpointUrl: row.url,
      failures: WEBHOOK_DISABLE_AFTER,
      lastError: lastDelivery?.error ?? null,
      teamName: row.teamName,
      settingsUrl: getAppUrl("/dashboard/settings#webhooks", row.teamSlug),
    }),
    context: { webhookId },
  });
}
