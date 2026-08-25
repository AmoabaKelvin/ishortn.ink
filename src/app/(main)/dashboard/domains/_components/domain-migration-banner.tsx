"use client";

import { IconAlertTriangle } from "@tabler/icons-react";

import { DOMAIN_MIGRATION_OPEN_EVENT } from "@/app/(main)/dashboard/_components/domain-migration-gate";
import { api } from "@/trpc/react";

export function DomainMigrationBanner() {
  const { data } = api.customDomain.migrationStatus.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const pendingCount = data?.filter((entry) => !entry.cloudflareActive).length ?? 0;

  if (pendingCount === 0) {
    return null;
  }

  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-amber-100 dark:border-amber-800 bg-amber-50 dark:bg-amber-500/10 px-4 py-3">
      <IconAlertTriangle
        size={14}
        stroke={1.5}
        className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-amber-700 dark:text-amber-400">
          {pendingCount === 1
            ? "1 domain needs a DNS update"
            : `${pendingCount} domains need a DNS update`}
        </p>
        <p className="mt-0.5 text-[12px] text-amber-600 dark:text-amber-400">
          ishortn has moved to new infrastructure and the old network is switched off. Links on{" "}
          {pendingCount === 1 ? "this domain" : "these domains"} stay down until you update the DNS
          records.
        </p>
      </div>
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(DOMAIN_MIGRATION_OPEN_EVENT))}
        className="shrink-0 rounded-md px-2 py-1 text-[12px] font-medium text-amber-700 dark:text-amber-400 transition-colors hover:bg-amber-100 dark:hover:bg-amber-500/20"
      >
        View instructions
      </button>
    </div>
  );
}
