import { IconClock } from "@tabler/icons-react";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { isPlatformRequest } from "@/components/link-status/branding";
import { LinkStatusPage } from "@/components/link-status/link-status-page";
import { linkStatusMetadata } from "@/components/link-status/metadata";
import { isLinkScheduled } from "@/middlewares/link-policy";
import { db } from "@/server/db";
import { link } from "@/server/db/schema";

export const dynamic = "force-dynamic";

export const metadata = linkStatusMetadata("Link not active yet");

interface ScheduledPageProps {
  params: Promise<{ linkId: string }>;
}

export default async function ScheduledPage({ params }: ScheduledPageProps) {
  const { linkId } = await params;
  const id = Number(linkId);
  if (!Number.isSafeInteger(id)) notFound();

  const linkRecord = await db.query.link.findFirst({
    where: eq(link.id, id),
    columns: { activateAt: true },
  });

  if (!linkRecord?.activateAt || !isLinkScheduled(linkRecord)) {
    notFound();
  }

  const goesLive = linkRecord.activateAt.toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  });

  return (
    <LinkStatusPage
      icon={<IconClock size={24} stroke={1.5} />}
      branded={await isPlatformRequest()}
      tone="blue"
      title="Link not active yet"
      description="This link is scheduled to go live later. Check back then."
      details={{ label: "Goes live", value: `${goesLive} UTC` }}
    />
  );
}
