import { IconCircleCheck } from "@tabler/icons-react";

import { PLAN_NAMES } from "@/lib/billing/entitlements";
import { displayName } from "@/lib/utils/user-name";
import { api } from "@/trpc/server";

import type { Plan } from "@/lib/billing/plans";
import type { RouterOutputs } from "@/trpc/shared";

type Overview = RouterOutputs["admin"]["getEntitlements"];

const formatDay = (date: Date) =>
  new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function GraceStatus({ endsAt, active }: { endsAt: Date | null; active: boolean }) {
  if (!endsAt) {
    return <span className="text-neutral-400 dark:text-muted-foreground">Not started</span>;
  }
  return active ? (
    <span className="text-amber-700 dark:text-amber-400">Grace until {formatDay(endsAt)}</span>
  ) : (
    <span className="text-red-600 dark:text-red-400">Restricted since {formatDay(endsAt)}</span>
  );
}

function PlanChip({ plan }: { plan: Plan }) {
  return (
    <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700 dark:bg-muted dark:text-neutral-300">
      {PLAN_NAMES[plan]}
    </span>
  );
}

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 px-4 py-12 text-center dark:border-border dark:bg-accent/50">
      <IconCircleCheck
        size={32}
        stroke={1.5}
        className="mx-auto mb-3 text-neutral-300 dark:text-neutral-600"
      />
      <p className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">{title}</p>
      <p className="mt-1 text-[12px] text-neutral-400 dark:text-muted-foreground">{description}</p>
    </div>
  );
}

function SummaryStats({ data }: { data: Overview }) {
  const inGrace =
    data.accountsInGrace + data.teams.filter((team) => !team.readOnly && team.graceEndsAt).length;
  const stats = [
    { label: "Accounts over plan", value: data.totalAccounts },
    { label: "Teams below Ultra", value: data.teams.length },
    { label: "In grace period", value: inGrace },
  ];

  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-border dark:bg-card"
        >
          <dt className="truncate text-[12px] text-neutral-500 dark:text-neutral-400">
            {stat.label}
          </dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-neutral-900 dark:text-foreground">
            {stat.value.toLocaleString()}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default async function AdminEntitlementsPage() {
  // Next renders this page alongside the admin layout, so a non-admin would
  // still run (and fail) the admin query while the layout shows its no-access state.
  const profile = await api.user.getProfile.query();
  if (!profile.isAdmin) return null;

  const data = await api.admin.getEntitlements.query();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
          Entitlements
        </h1>
        <p className="mt-1 text-[13px] text-neutral-400 dark:text-muted-foreground">
          Accounts using features above their live plan, and teams whose owner isn&apos;t on Ultra
        </p>
      </div>

      <div className="space-y-10">
        <SummaryStats data={data} />

        {/* Accounts */}
        <section>
          <div className="mb-4">
            <h2 className="text-[14px] font-semibold text-neutral-900 dark:text-foreground">
              Accounts over their plan
            </h2>
            <p className="mt-1 text-[12px] text-neutral-400 dark:text-muted-foreground">
              Personal workspaces, compared with the plan they pay for now
              {data.totalAccounts > data.accounts.length &&
                ` · showing ${data.accounts.length.toLocaleString()} of ${data.totalAccounts.toLocaleString()}`}
            </p>
          </div>

          {data.featureCounts.length > 0 && (
            <ul className="mb-4 flex flex-wrap gap-1.5">
              {data.featureCounts.map((item) => (
                <li
                  key={item.feature}
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-0.5 text-[11px] text-neutral-700 dark:border-border dark:bg-card dark:text-neutral-300"
                >
                  {item.label}
                  <span className="font-medium tabular-nums text-neutral-900 dark:text-foreground">
                    {item.accounts.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {data.accounts.length === 0 ? (
            <EmptyPanel
              title="No accounts over their plan"
              description="Every personal workspace fits within the plan it pays for"
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-border">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-border dark:bg-accent/50">
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400">
                      Account
                    </th>
                    <th className="hidden whitespace-nowrap px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400 md:table-cell">
                      Plan
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400">
                      Above plan
                    </th>
                    <th className="hidden whitespace-nowrap px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400 lg:table-cell">
                      Grace
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-border/50">
                  {data.accounts.map((account) => (
                    <tr key={account.userId} className="align-top">
                      <td className="px-4 py-3">
                        <p className="break-words text-[13px] font-medium text-neutral-900 dark:text-foreground">
                          {displayName(account.name) ?? "Unnamed"}
                        </p>
                        <p className="break-all text-[11px] text-neutral-400 dark:text-muted-foreground">
                          {account.email ?? account.userId}
                        </p>
                        <p className="mt-1 text-[11px] lg:hidden">
                          <GraceStatus endsAt={account.graceEndsAt} active={account.graceActive} />
                        </p>
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 md:table-cell">
                        <div className="flex items-center gap-1.5 text-[12px] text-neutral-500 dark:text-neutral-400">
                          <PlanChip plan={account.paidPlan} />
                          <span aria-hidden>&rarr;</span>
                          <span className="sr-only">needs</span>
                          <PlanChip plan={account.requiredPlan} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <ul className="space-y-0.5 text-[12px] text-neutral-700 dark:text-neutral-300">
                          {account.features.map((item) => (
                            <li key={item.feature}>
                              {item.label}{" "}
                              <span className="tabular-nums text-neutral-400 dark:text-muted-foreground">
                                {item.amount.toLocaleString()} / {item.limit.toLocaleString()}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-[12px] lg:table-cell">
                        <GraceStatus endsAt={account.graceEndsAt} active={account.graceActive} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Teams */}
        <section>
          <div className="mb-4">
            <h2 className="text-[14px] font-semibold text-neutral-900 dark:text-foreground">
              Teams below Ultra
            </h2>
            <p className="mt-1 text-[12px] text-neutral-400 dark:text-muted-foreground">
              Read-only for every member once the grace period ends
            </p>
          </div>

          {data.teams.length === 0 ? (
            <EmptyPanel
              title="No teams below Ultra"
              description="Every team owner is on the Ultra plan"
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-border">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-border dark:bg-accent/50">
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400">
                      Team
                    </th>
                    <th className="hidden whitespace-nowrap px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400 md:table-cell">
                      Owner plan
                    </th>
                    <th className="hidden whitespace-nowrap px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400 md:table-cell">
                      Members
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-border/50">
                  {data.teams.map((team) => (
                    <tr key={team.teamId}>
                      <td className="px-4 py-3">
                        <p className="break-words text-[13px] font-medium text-neutral-900 dark:text-foreground">
                          {team.name}
                        </p>
                        <p className="break-all text-[11px] text-neutral-400 dark:text-muted-foreground">
                          {team.ownerEmail ?? team.slug}
                        </p>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <PlanChip plan={team.ownerPlan} />
                      </td>
                      <td className="hidden px-4 py-3 text-[12px] tabular-nums text-neutral-500 dark:text-neutral-400 md:table-cell">
                        {team.members.toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[12px]">
                        {team.readOnly ? (
                          <span className="text-red-600 dark:text-red-400">Read-only</span>
                        ) : (
                          <GraceStatus endsAt={team.graceEndsAt} active={!!team.graceEndsAt} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
