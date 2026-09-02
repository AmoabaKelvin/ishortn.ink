import { IconClock } from "@tabler/icons-react";
import { eq } from "drizzle-orm";
import { Funnel_Sans } from "next/font/google";
import { notFound } from "next/navigation";

import { cn } from "@/lib/utils";
import { isLinkScheduled } from "@/middlewares/resolve-link";
import { db } from "@/server/db";
import { link } from "@/server/db/schema";

const funnelSans = Funnel_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
});

interface ScheduledPageProps {
  params: Promise<{ linkId: string }>;
}

export default async function ScheduledPage({ params }: ScheduledPageProps) {
  const { linkId } = await params;

  const linkRecord = await db.query.link.findFirst({
    where: eq(link.id, Number(linkId)),
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
    <div
      className={cn(
        "flex min-h-screen items-center justify-center bg-neutral-50 px-4",
        funnelSans.className,
      )}
    >
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
          <IconClock size={24} stroke={1.5} className="text-blue-600" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
          Not Live Yet
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">
          The link you are trying to visit is scheduled to go live later.
        </p>
        <div className="mt-5 rounded-lg border border-neutral-200 bg-white px-4 py-3">
          <p className="text-[12px] font-medium text-neutral-400">Goes live</p>
          <p className="mt-1 text-[13px] text-neutral-700">{goesLive} UTC</p>
        </div>
        <p className="mt-6 text-[12px] text-neutral-400">
          Check back then, or contact the link owner if you were expecting it to work now.
        </p>
      </div>
    </div>
  );
}
