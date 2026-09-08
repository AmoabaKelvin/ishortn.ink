import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { logger } from "@/lib/logger";
import { runBackgroundTask } from "@/lib/utils/background";
import { db } from "@/server/db";
import { bioPageView, linkVisit, uniqueBioPageView, uniqueLinkVisit } from "@/server/db/schema";

import { reserveEventUsage } from "./event-usage";
import { checkAndFireMilestones } from "./milestone-check";
import { type SendEventUsageEmailInput, sendEventUsageEmail } from "./notifications/event-usage";

import type { DbClient } from "./user-plan";
import type {
  BioViewEvent,
  ClickEvent,
  LinkClickEvent,
  VerifyEvent,
} from "@/lib/core/analytics/click-event";

const log = logger.child({ component: "click-ingest" });

type VisitEvent = LinkClickEvent | BioViewEvent;

async function alreadyRecorded(tx: DbClient, events: VisitEvent[]): Promise<Set<string>> {
  const recorded = new Set<string>();
  const linkIds = events.filter((e) => e.kind === "link").map((e) => e.id);
  if (linkIds.length) {
    const rows = await tx
      .select({ id: linkVisit.visitId })
      .from(linkVisit)
      .where(inArray(linkVisit.visitId, linkIds));
    for (const row of rows) if (row.id) recorded.add(row.id);
  }
  const bioIds = events.filter((e) => e.kind === "bio").map((e) => e.id);
  if (bioIds.length) {
    const rows = await tx
      .select({ id: bioPageView.viewId })
      .from(bioPageView)
      .where(inArray(bioPageView.viewId, bioIds));
    for (const row of rows) if (row.id) recorded.add(row.id);
  }
  return recorded;
}

async function applyQuota(
  tx: DbClient,
  events: VisitEvent[],
): Promise<{ accepted: VisitEvent[]; alerts: SendEventUsageEmailInput[] }> {
  const byOwner = new Map<string, VisitEvent[]>();
  for (const event of events) {
    const bucket = byOwner.get(event.ownerId);
    if (bucket) bucket.push(event);
    else byOwner.set(event.ownerId, [event]);
  }

  const accepted: VisitEvent[] = [];
  const alerts: SendEventUsageEmailInput[] = [];
  for (const [ownerId, ownerEvents] of byOwner) {
    ownerEvents.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    const { allowed, alert } = await reserveEventUsage(ownerId, ownerEvents.length, tx);
    accepted.push(...ownerEvents.slice(0, allowed));
    if (alert) alerts.push(alert);
    if (allowed < ownerEvents.length) {
      log.debug({ ownerId, dropped: ownerEvents.length - allowed }, "events over monthly quota");
    }
  }
  return { accepted, alerts };
}

async function insertLinkVisits(tx: DbClient, events: LinkClickEvent[]): Promise<void> {
  if (events.length === 0) return;
  await tx
    .insert(linkVisit)
    .values(
      events.map((e) => ({
        linkId: e.linkId,
        device: e.device,
        browser: e.browser,
        os: e.os,
        model: e.model,
        referer: e.referer,
        country: e.country,
        city: e.city,
        continent: e.continent,
        matchedGeoRuleId: e.matchedGeoRuleId,
        visitId: e.id,
        createdAt: new Date(e.occurredAt),
      })),
    )
    .onDuplicateKeyUpdate({ set: { visitId: sql`visitId` } });
  await tx
    .insert(uniqueLinkVisit)
    .values(
      events.map((e) => ({
        linkId: e.linkId,
        ipHash: e.ipHash,
        createdAt: new Date(e.occurredAt),
      })),
    )
    .onDuplicateKeyUpdate({ set: { linkId: sql`linkId` } });
}

async function insertBioViews(tx: DbClient, events: BioViewEvent[]): Promise<void> {
  if (events.length === 0) return;
  await tx
    .insert(bioPageView)
    .values(
      events.map((e) => ({
        bioPageId: e.bioPageId,
        device: e.device,
        browser: e.browser,
        os: e.os,
        model: e.model,
        referer: e.referer,
        country: e.country,
        city: e.city,
        continent: e.continent,
        viewId: e.id,
        createdAt: new Date(e.occurredAt),
      })),
    )
    .onDuplicateKeyUpdate({ set: { viewId: sql`viewId` } });
  await tx
    .insert(uniqueBioPageView)
    .values(
      events.map((e) => ({
        bioPageId: e.bioPageId,
        ipHash: e.ipHash,
        createdAt: new Date(e.occurredAt),
      })),
    )
    .onDuplicateKeyUpdate({ set: { bioPageId: sql`bioPageId` } });
}

// Verify events are enqueued with a delay, so the click row is normally there;
// a miss (bot-filtered or over-quota click) is dropped.
async function markVerified(tx: DbClient, events: VerifyEvent[]): Promise<void> {
  for (const event of events) {
    await tx
      .update(linkVisit)
      .set({ verifiedAt: new Date(event.verifiedAt) })
      .where(and(eq(linkVisit.visitId, event.visitId), isNull(linkVisit.verifiedAt)));
  }
}

// Already-recorded events are skipped before quota is charged, so a redelivered
// batch cannot double count. Emails and milestone checks run after commit.
export async function ingestClickBatch(events: ClickEvent[]): Promise<void> {
  const visits = events.filter((e): e is VisitEvent => e.kind !== "verify");

  const { accepted, alerts } = await db.transaction(async (tx) => {
    const recorded = await alreadyRecorded(tx, visits);
    const { accepted, alerts } = await applyQuota(
      tx,
      visits.filter((e) => !recorded.has(e.id)),
    );
    await insertLinkVisits(
      tx,
      accepted.filter((e): e is LinkClickEvent => e.kind === "link"),
    );
    await insertBioViews(
      tx,
      accepted.filter((e): e is BioViewEvent => e.kind === "bio"),
    );
    await markVerified(
      tx,
      events.filter((e): e is VerifyEvent => e.kind === "verify"),
    );
    return { accepted, alerts };
  });

  for (const alert of alerts) {
    void runBackgroundTask(sendEventUsageEmail(alert));
  }

  const milestoneTargets = new Map<number, string>();
  for (const event of accepted) {
    if (event.kind === "link") milestoneTargets.set(event.linkId, event.ownerId);
  }
  for (const [linkId, ownerId] of milestoneTargets) {
    void runBackgroundTask(checkAndFireMilestones(linkId, ownerId));
  }
}
