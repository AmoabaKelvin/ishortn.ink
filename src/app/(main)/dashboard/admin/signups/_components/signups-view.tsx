"use client";

import { IconUserPlus } from "@tabler/icons-react";
import { useState } from "react";

import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SIGNUP_CHANNELS, SIGNUP_DIMENSIONS } from "@/server/api/routers/admin/utils";

import { StatCard } from "../../_components/stat-card";
import { SignupsChart } from "./signups-chart";

import type { SignupChannel, SignupDimension } from "@/server/api/routers/admin/utils";
import type { RouterOutputs } from "@/trpc/shared";

type SignupAttribution = RouterOutputs["admin"]["getSignupAttribution"];

const DIMENSION_LABELS = {
  channel: "Channel",
  source: "Source",
  medium: "Medium",
  campaign: "Campaign",
  referrer: "Referrer",
  landingPath: "Landing page",
} satisfies Record<SignupDimension, string>;

const CHANNEL_LABELS = {
  paid: "Paid",
  campaign: "Campaign (UTM)",
  organic: "Organic search",
  referral: "Referral",
  direct: "Direct",
  unknown: "Not recorded",
} satisfies Record<SignupChannel, string>;

function isDimension(value: string): value is SignupDimension {
  return SIGNUP_DIMENSIONS.some((dim) => dim === value);
}

function rowLabel(key: string): string {
  const channel = SIGNUP_CHANNELS.find((c) => c === key);
  return channel ? CHANNEL_LABELS[channel] : key;
}

function percent(part: number, total: number): string {
  if (total <= 0) return "0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

function plural(count: number, word: string): string {
  return `${count.toLocaleString()} ${count === 1 ? word : `${word}s`}`;
}

export function SignupsView({ data }: { data: SignupAttribution }) {
  const [dimension, setDimension] = useState<SignupDimension>("channel");
  const { totals, breakdowns } = data;
  const rows = breakdowns[dimension];
  const topSource = breakdowns.source.find((row) => row.key !== "(not recorded)");

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
          Signups
        </h1>
        <p className="mt-1 text-[13px] text-neutral-400 dark:text-muted-foreground">
          New accounts by first-touch source over the last 90 days
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Signups" value={totals.signups.toLocaleString()} hint="Last 90 days" />
        <StatCard
          title="Paid conversions"
          value={totals.paid.toLocaleString()}
          hint={`${percent(totals.paid, totals.signups)} of signups`}
        />
        <StatCard
          title="Attributed"
          value={percent(totals.attributed, totals.signups)}
          hint={`${plural(totals.attributed, "signup")} recorded`}
        />
        <StatCard
          title="Top source"
          value={topSource?.key ?? "—"}
          hint={topSource ? plural(topSource.signups, "signup") : undefined}
        />
      </div>

      {totals.signups === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-neutral-300 dark:border-border bg-neutral-50/50 dark:bg-accent/50 px-4 py-12 text-center">
          <IconUserPlus
            size={32}
            stroke={1.5}
            className="mx-auto mb-3 text-neutral-300 dark:text-neutral-600"
          />
          <p className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">
            No signups in the last 90 days
          </p>
          <p className="mt-1 text-[12px] text-neutral-400 dark:text-muted-foreground">
            New accounts and their first-touch source will show up here
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4">
            <SignupsChart data={data} />
          </div>

          <Card className="mt-4 overflow-hidden rounded-xl border-neutral-200 dark:border-border shadow-none">
            <div className="flex flex-col gap-3 border-b border-neutral-100 dark:border-border/50 px-5 pb-4 pt-5">
              <div className="space-y-0.5">
                <h2 className="text-[14px] font-semibold tracking-tight text-neutral-900 dark:text-foreground">
                  Breakdown
                </h2>
                <p className="text-[12px] text-neutral-400 dark:text-muted-foreground">
                  Paid counts signups that later started a subscription. Not recorded means the
                  signup has no first-touch record.
                </p>
              </div>
              <div className="-mx-5 overflow-x-auto px-5">
                <Tabs value={dimension} onValueChange={(v) => isDimension(v) && setDimension(v)}>
                  <TabsList className="h-7">
                    {SIGNUP_DIMENSIONS.map((dim) => (
                      <TabsTrigger key={dim} value={dim} className="px-2.5 text-[11px]">
                        {DIMENSION_LABELS[dim]}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            </div>

            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50">
                  <th className="w-full px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400">
                    {DIMENSION_LABELS[dimension]}
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-neutral-500 dark:text-neutral-400">
                    Signups
                  </th>
                  <th className="hidden px-4 py-3 text-right font-medium text-neutral-500 dark:text-neutral-400 sm:table-cell">
                    Share
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-neutral-500 dark:text-neutral-400">
                    Paid
                  </th>
                  <th className="hidden px-4 py-3 text-right font-medium text-neutral-500 dark:text-neutral-400 sm:table-cell">
                    Conversion
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-border/50">
                {rows.map((row) => {
                  const label = dimension === "channel" ? rowLabel(row.key) : row.key;
                  return (
                    <tr key={row.key} className="hover:bg-neutral-50/50 dark:hover:bg-accent/50">
                      <td className="max-w-0 px-4 py-3">
                        <p
                          className="truncate font-medium text-neutral-800 dark:text-neutral-200"
                          title={label}
                        >
                          {label}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700 dark:text-neutral-300">
                        {row.signups.toLocaleString()}
                      </td>
                      <td className="hidden px-4 py-3 text-right text-[12px] tabular-nums text-neutral-500 dark:text-neutral-400 sm:table-cell">
                        {percent(row.signups, totals.signups)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700 dark:text-neutral-300">
                        {row.paid.toLocaleString()}
                      </td>
                      <td className="hidden px-4 py-3 text-right text-[12px] tabular-nums text-neutral-500 dark:text-neutral-400 sm:table-cell">
                        {percent(row.paid, row.signups)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
