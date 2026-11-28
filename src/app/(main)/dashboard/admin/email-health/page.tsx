import { IconMailCheck } from "@tabler/icons-react";

import { displayName } from "@/lib/utils/user-name";
import { EMAIL_SUPPRESSION_RECENT_LIMIT } from "@/server/api/routers/admin/admin.service";
import { api } from "@/trpc/server";

import { StatCard } from "../_components/stat-card";

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function AdminEmailHealthPage() {
  const { counts, recent } = await api.admin.getEmailSuppressions.query();

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
          Email Health
        </h1>
        <p className="mt-1 text-[13px] text-neutral-400 dark:text-muted-foreground">
          Addresses that hard-bounced or marked our email as spam. Only security and billing email
          is still sent to them.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard
          title="Bounced"
          value={counts.bounced.toLocaleString()}
          hint={counts.bounced === 1 ? "address" : "addresses"}
        />
        <StatCard
          title="Complained"
          value={counts.complained.toLocaleString()}
          hint={counts.complained === 1 ? "address" : "addresses"}
        />
      </div>

      <div className="mt-8">
        <h2 className="text-[14px] font-semibold text-neutral-900 dark:text-foreground">
          Recent events
        </h2>
        <p className="mt-0.5 mb-3 text-[12px] text-neutral-400 dark:text-muted-foreground">
          The {EMAIL_SUPPRESSION_RECENT_LIMIT} most recent, newest first
        </p>

        {recent.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 dark:border-border bg-neutral-50/50 dark:bg-accent/50 px-4 py-12 text-center">
            <IconMailCheck
              size={32}
              stroke={1.5}
              className="mx-auto mb-3 text-neutral-300 dark:text-neutral-600"
            />
            <p className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">
              No bounces or complaints
            </p>
            <p className="mt-1 text-[12px] text-neutral-400 dark:text-muted-foreground">
              Addresses appear here when Resend reports them
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-border">
            <table className="w-full table-fixed text-left text-[13px]">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50">
                  <th className="px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400">
                    Address
                  </th>
                  <th className="w-36 px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400">
                    Type
                  </th>
                  <th className="hidden w-36 px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400 md:table-cell">
                    Last event
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-border/50">
                {recent.map((row) => (
                  <tr key={row.id} className="hover:bg-neutral-50/50 dark:hover:bg-accent/50">
                    <td className="px-4 py-3">
                      <p className="break-all text-[13px] font-medium text-neutral-800 dark:text-neutral-200">
                        {row.email}
                      </p>
                      <p className="truncate text-[11px] text-neutral-400 dark:text-muted-foreground">
                        {row.userId ? (displayName(row.userName) ?? row.userId) : "No account"}
                        {row.detail && ` · ${row.detail}`}
                      </p>
                      <p className="text-[11px] text-neutral-400 dark:text-muted-foreground md:hidden">
                        {formatDate(row.lastEventAt)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          row.clearedAt
                            ? "bg-neutral-100 dark:bg-muted text-neutral-500 dark:text-neutral-400"
                            : row.type === "complained"
                              ? "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400"
                              : "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {row.type === "complained" ? "Complained" : "Bounced"}
                        {row.clearedAt && " · cleared"}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
                        {formatDate(row.lastEventAt)}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
