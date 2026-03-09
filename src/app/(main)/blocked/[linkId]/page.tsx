import { IconBan } from "@tabler/icons-react";
import { and, eq } from "drizzle-orm";
import { Funnel_Sans } from "next/font/google";
import { notFound } from "next/navigation";

import { cn } from "@/lib/utils";
import { db } from "@/server/db";
import { geoRule, link } from "@/server/db/schema";

const funnelSans = Funnel_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
});

interface BlockedPageProps {
  params: Promise<{ linkId: string }>;
  searchParams: Promise<{ geo?: string }>;
}

export default async function BlockedPage({ params, searchParams }: BlockedPageProps) {
  const [{ linkId }, { geo }] = await Promise.all([params, searchParams]);

  const linkRecord = await db.query.link.findFirst({
    where: eq(link.id, Number(linkId)),
    columns: { id: true, blocked: true, blockedReason: true },
  });

  if (!linkRecord) {
    notFound();
  }

  let reason: string;

  if (linkRecord.blocked) {
    reason =
      linkRecord.blockedReason ??
      "This link has been blocked for violating our terms of service.";
  } else if (geo) {
    // Fetch the geo rule's custom block message server-side
    const geoRuleId = Number(geo);
    const rule = Number.isFinite(geoRuleId)
      ? await db.query.geoRule.findFirst({
          where: and(
            eq(geoRule.id, geoRuleId),
            eq(geoRule.linkId, linkRecord.id),
          ),
          columns: { blockMessage: true },
        })
      : null;
    reason =
      rule?.blockMessage ?? "This link is not available in your region.";
  } else {
    reason = "This link is not available in your region.";
  }

  return (
    <div
      className={cn(
        "flex min-h-screen items-center justify-center bg-neutral-50 px-4",
        funnelSans.className,
      )}
    >
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <IconBan size={24} stroke={1.5} className="text-red-600" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
          Access Restricted
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">
          This link has been blocked and is no longer accessible.
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
