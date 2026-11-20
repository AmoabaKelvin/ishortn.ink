import { IconClockOff } from "@tabler/icons-react";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { isPlatformRequest } from "@/components/link-status/branding";
import { LinkStatusPage } from "@/components/link-status/link-status-page";
import { linkStatusMetadata } from "@/components/link-status/metadata";
import { db } from "@/server/db";
import { link } from "@/server/db/schema";
import { getTotalClicks } from "@/server/lib/total-clicks";

export const dynamic = "force-dynamic";

export const metadata = linkStatusMetadata("Link expired");

interface ExpiredPageProps {
  params: Promise<{ linkId: string }>;
}

export default async function ExpiredPage({ params }: ExpiredPageProps) {
  const { linkId } = await params;
  const id = Number(linkId);
  if (!Number.isSafeInteger(id)) notFound();

  const linkRecord = await db.query.link.findFirst({
    where: eq(link.id, id),
    columns: {
      id: true,
      disabled: true,
      disableLinkAfterDate: true,
      disableLinkAfterClicks: true,
    },
  });

  if (!linkRecord) {
    notFound();
  }

  // Determine which expiration condition is active
  const dateExpired =
    linkRecord.disableLinkAfterDate != null &&
    new Date(linkRecord.disableLinkAfterDate) <= new Date();

  let clicksExpired = false;
  if (!dateExpired && linkRecord.disableLinkAfterClicks != null) {
    const clickCount = await getTotalClicks(linkRecord.id);
    clicksExpired = clickCount >= linkRecord.disableLinkAfterClicks;
  }

  if (!linkRecord.disabled && !dateExpired && !clicksExpired) {
    notFound();
  }

  let description: string;
  if (dateExpired) {
    description = "This link has expired and no longer accepts visits.";
  } else if (clicksExpired) {
    description = "This link reached its visit limit and no longer accepts visits.";
  } else {
    description = "This link was turned off by its owner.";
  }

  return (
    <LinkStatusPage
      icon={<IconClockOff size={24} stroke={1.5} />}
      branded={await isPlatformRequest()}
      tone="amber"
      title="Link expired"
      description={description}
      campaign="expired"
    />
  );
}
