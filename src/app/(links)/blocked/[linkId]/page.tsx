import { IconBan, IconWorldOff } from "@tabler/icons-react";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { isPlatformRequest } from "@/components/link-status/branding";
import { LinkStatusPage } from "@/components/link-status/link-status-page";
import { linkStatusMetadata } from "@/components/link-status/metadata";
import { getBlockedLinkMessage } from "@/components/link-status/utils";
import { getRequestGeo } from "@/lib/platform";
import { getLinkGeoRules, getRuleDevice, matchLinkRules } from "@/middlewares/resolve-link";
import { db } from "@/server/db";
import { link } from "@/server/db/schema";

export const dynamic = "force-dynamic";

export const metadata = linkStatusMetadata("Link unavailable");

interface BlockedPageProps {
  params: Promise<{ linkId: string }>;
  searchParams: Promise<{ geo?: string }>;
}

export default async function BlockedPage({ params, searchParams }: BlockedPageProps) {
  const [{ linkId }, { geo }] = await Promise.all([params, searchParams]);
  const id = Number(linkId);
  if (!Number.isSafeInteger(id)) notFound();

  const linkRecord = await db.query.link.findFirst({
    where: eq(link.id, id),
    columns: { id: true, blocked: true, blockedReason: true },
  });
  if (!linkRecord) notFound();

  if (linkRecord.blocked) {
    return (
      <LinkStatusPage
        icon={<IconBan size={24} stroke={1.5} />}
        branded={await isPlatformRequest()}
        tone="red"
        title="Link unavailable"
        description={getBlockedLinkMessage(linkRecord.blockedReason)}
        campaign="blocked"
      />
    );
  }

  // A geo block only shows when the link's rules block this visitor right now,
  // so the page can't be shown for a working link by editing the URL.
  if (!geo) notFound();
  const [rules, headersList] = await Promise.all([getLinkGeoRules(linkRecord.id), headers()]);
  const device = await getRuleDevice(rules, headersList);
  const match = matchLinkRules(rules, getRequestGeo().country ?? "Unknown", device);
  if (!match.matched || match.action !== "block" || String(match.ruleId) !== geo) notFound();

  const rule = rules?.find((r) => r.id === match.ruleId);

  return (
    <LinkStatusPage
      icon={<IconWorldOff size={24} stroke={1.5} />}
      branded={await isPlatformRequest()}
      tone="red"
      title="Link unavailable"
      description={rule?.blockMessage || "This link is not available in your region."}
      campaign="blocked"
    />
  );
}
