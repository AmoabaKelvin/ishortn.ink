import { Suspense } from "react";

import { getSystemStatus } from "@/lib/status";
import { cn } from "@/lib/utils";

import type { SystemStatus } from "@/lib/status";

const STATUS_PAGE_URL = "https://status.ishortn.ink";

const STATUS_DISPLAY = {
  operational: { label: "All systems operational", dot: "bg-emerald-500" },
  degraded: { label: "Degraded performance", dot: "bg-amber-500" },
  outage: { label: "Major outage", dot: "bg-red-500" },
} satisfies Record<SystemStatus, { label: string; dot: string }>;

const StatusLink = ({ status }: { status: SystemStatus | null }) => {
  const display = status ? STATUS_DISPLAY[status] : null;
  return (
    <a
      href={STATUS_PAGE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 font-mono text-xs font-medium text-neutral-800 shadow-site-btn hover:bg-neutral-50"
    >
      {display?.label ?? "Status"}
      {display && <span aria-hidden="true" className={cn("size-1.5 rounded-full", display.dot)} />}
    </a>
  );
};

const LiveStatusLink = async () => <StatusLink status={await getSystemStatus()} />;

// Without a provider (or while it's unreachable) we show a neutral link rather than claim uptime.
export const StatusBadge = () => (
  <Suspense fallback={<StatusLink status={null} />}>
    <LiveStatusLink />
  </Suspense>
);
