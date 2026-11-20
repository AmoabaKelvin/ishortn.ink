import { and, eq, isNull } from "drizzle-orm";

import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import { link, linkMilestone, team, user } from "@/server/db/schema";
import { sendLinkMilestoneEmail } from "@/server/lib/notifications/link-milestone";
import { getTotalClicks } from "@/server/lib/total-clicks";

const log = logger.child({ component: "milestone-check" });

/**
 * Check if any pending milestones have been reached for a link and fire
 * notifications for those that have. Uses atomic UPDATE with notifiedAt IS NULL
 * guard to prevent duplicate notifications under concurrent requests.
 */
export async function checkAndFireMilestones(linkId: number, userId: string): Promise<void> {
  try {
    // Fast path: check if any pending milestones exist for this link
    const pendingMilestones = await db
      .select({
        id: linkMilestone.id,
        threshold: linkMilestone.threshold,
      })
      .from(linkMilestone)
      .where(and(eq(linkMilestone.linkId, linkId), isNull(linkMilestone.notifiedAt)));

    if (pendingMilestones.length === 0) return;

    const totalClicks = await getTotalClicks(linkId);

    // Find milestones that have been reached
    const reachedMilestones = pendingMilestones.filter((m) => totalClicks >= m.threshold);

    if (reachedMilestones.length === 0) return;

    // Fetch user info and link info for the email
    const [linkOwner, [linkRecord]] = await Promise.all([
      db.query.user.findFirst({
        where: eq(user.id, userId),
        columns: { email: true, name: true, productEmailsEnabled: true },
      }),
      db
        .select({ alias: link.alias, domain: link.domain, name: link.name, teamSlug: team.slug })
        .from(link)
        .leftJoin(team, eq(team.id, link.teamId))
        .where(eq(link.id, linkId))
        .limit(1),
    ]);

    if (!linkOwner?.email || !linkRecord?.alias) return;

    // Milestones are still marked notified when emails are off, so they don't fire later.
    const sendEmails = linkOwner.productEmailsEnabled;

    // Fire notifications — atomic UPDATE guards against duplicates,
    // then send emails in parallel
    const emailPromises: Promise<void>[] = [];
    for (const milestone of reachedMilestones) {
      const updateResult = await db
        .update(linkMilestone)
        .set({ notifiedAt: new Date() })
        .where(and(eq(linkMilestone.id, milestone.id), isNull(linkMilestone.notifiedAt)));

      if (updateResult[0].affectedRows === 1 && sendEmails) {
        emailPromises.push(
          sendLinkMilestoneEmail({
            userId,
            email: linkOwner.email,
            name: linkOwner.name,
            linkAlias: linkRecord.alias,
            linkDomain: linkRecord.domain,
            linkName: linkRecord.name,
            teamSlug: linkRecord.teamSlug,
            milestone: milestone.threshold,
            totalClicks,
          }),
        );
      }
    }

    await Promise.all(emailPromises);
  } catch (error) {
    // Swallow errors — milestone checks must never break the redirect flow
    log.error({ err: error, linkId, userId }, "failed to check milestones");
  }
}
