import { IconClockOff } from "@tabler/icons-react";
import { count, eq } from "drizzle-orm";
import { Funnel_Sans } from "next/font/google";
import { notFound } from "next/navigation";

import { cn } from "@/lib/utils";
import { db } from "@/server/db";
import { link, linkVisit } from "@/server/db/schema";

const funnelSans = Funnel_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
});

interface ExpiredPageProps {
  params: Promise<{ linkId: string }>;
}

export default async function ExpiredPage({ params }: ExpiredPageProps) {
  const { linkId } = await params;

  const linkRecord = await db.query.link.findFirst({
    where: eq(link.id, Number(linkId)),
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
  if (linkRecord.disableLinkAfterClicks != null) {
    const result = await db
      .select({ clickCount: count(linkVisit.id) })
      .from(linkVisit)
      .where(eq(linkVisit.linkId, linkRecord.id));
    clicksExpired =
      (result[0]?.clickCount ?? 0) >= linkRecord.disableLinkAfterClicks;
  }

  if (!linkRecord.disabled && !dateExpired && !clicksExpired) {
    notFound();
  }

  let reason: string;

  if (dateExpired) {
    reason = "This link has expired and is no longer accepting visits.";
  } else if (clicksExpired) {
    reason = "This link has reached its maximum number of visits and is no longer accessible.";
  } else {
    reason = "This link has been deactivated by its owner.";
  }

  return (
    <div
      className={cn(
        "flex min-h-screen items-center justify-center bg-neutral-50 px-4",
        funnelSans.className,
      )}
    >
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
          <IconClockOff size={24} stroke={1.5} className="text-amber-600" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
          Link Expired
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">
          The link you are trying to visit is no longer active.
        </p>
        <div className="mt-5 rounded-lg border border-neutral-200 bg-white px-4 py-3">
          <p className="text-[12px] font-medium text-neutral-400">Details</p>
          <p className="mt-1 text-[13px] text-neutral-700">{reason}</p>
        </div>
        <p className="mt-6 text-[12px] text-neutral-400">
          If you believe this is a mistake, please contact the link owner or{" "}
          <a
            href="mailto:support@ishortn.ink"
            className="text-neutral-600 underline underline-offset-2"
          >
            support@ishortn.ink
          </a>
        </p>
      </div>
    </div>
  );
}
