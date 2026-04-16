"use client";

import { formatPrice } from "@/lib/utils";
import type { RouterOutputs } from "@/trpc/shared";

import { StatCard } from "../../_components/stat-card";

type Summary = RouterOutputs["admin"]["getUserBaseSummary"];

export function UserBaseStats({
  data,
  isLoading,
}: {
  data: Summary | undefined;
  isLoading: boolean;
}) {
  const placeholder = isLoading ? "..." : "0";

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        title="Total Users"
        value={data ? data.totalUsers.toLocaleString() : placeholder}
      />
      <StatCard
        title="Paid Users"
        value={data ? data.paidUsers.toLocaleString() : placeholder}
        growth={data?.paidGrowth ?? null}
        hint={data ? `${data.paidPercent}% of users` : undefined}
      />
      <StatCard
        title="MRR"
        value={data ? formatPrice(data.mrr, { notation: "standard", maximumFractionDigits: 0 }) : placeholder}
        hint={data ? "estimated" : undefined}
      />
      <StatCard
        title="New Paid (in range)"
        value={data ? data.newPaid.toLocaleString() : placeholder}
        growth={data?.newPaidGrowth ?? null}
      />
    </div>
  );
}
