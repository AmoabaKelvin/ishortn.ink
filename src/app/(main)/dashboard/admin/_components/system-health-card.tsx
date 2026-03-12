"use client";

import { Card } from "@/components/ui/card";

type HealthData = {
  totalLinks: number;
  totalUsers: number;
  blockedLinks: number;
  bannedUsers: number;
  blockedPercent: number;
  banRate: number;
  pendingFlagged: number;
  openFeedback: number;
  blockedDomains: number;
};

type Status = "green" | "amber" | "red" | "neutral";

const dotColor: Record<Status, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  neutral: "bg-neutral-300",
};

function StatusRow({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: string;
  detail?: string;
  status: Status;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <div className="flex items-center gap-2.5">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor[status]}`} />
        <span className="text-[13px] text-neutral-600">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {detail && (
          <span className="text-[11px] text-neutral-400">{detail}</span>
        )}
        <span className="min-w-[2rem] text-right text-[13px] font-semibold tabular-nums text-neutral-900">
          {value}
        </span>
      </div>
    </div>
  );
}

type SystemHealthCardProps = {
  data: HealthData | undefined;
  isLoading: boolean;
};

export function SystemHealthCard({ data, isLoading }: SystemHealthCardProps) {
  if (isLoading || !data) {
    return (
      <Card className="rounded-xl border-neutral-200 shadow-none">
        <div className="border-b border-neutral-100 px-5 py-4">
          <p className="text-[14px] font-semibold tracking-tight text-neutral-900">
            System Health
          </p>
        </div>
        <div className="flex items-center justify-center px-5 py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-400" />
        </div>
      </Card>
    );
  }

  const pctStatus = (v: number): Status =>
    v > 5 ? "red" : v > 2 ? "amber" : "green";

  return (
    <Card className="rounded-xl border-neutral-200 shadow-none">
      <div className="border-b border-neutral-100 px-5 py-4">
        <p className="text-[14px] font-semibold tracking-tight text-neutral-900">
          System Health
        </p>
        <p className="mt-0.5 text-[12px] text-neutral-400">
          {data.totalLinks.toLocaleString()} links &middot;{" "}
          {data.totalUsers.toLocaleString()} users
        </p>
      </div>
      <div className="divide-y divide-neutral-100">
        <StatusRow
          label="Blocked links"
          value={`${data.blockedPercent}%`}
          detail={`${data.blockedLinks.toLocaleString()} of ${data.totalLinks.toLocaleString()}`}
          status={pctStatus(data.blockedPercent)}
        />
        <StatusRow
          label="Ban rate"
          value={`${data.banRate}%`}
          detail={`${data.bannedUsers.toLocaleString()} of ${data.totalUsers.toLocaleString()}`}
          status={pctStatus(data.banRate)}
        />
        <StatusRow
          label="Pending flagged"
          value={data.pendingFlagged.toLocaleString()}
          status={
            data.pendingFlagged > 10
              ? "red"
              : data.pendingFlagged > 0
                ? "amber"
                : "green"
          }
        />
        <StatusRow
          label="Open feedback"
          value={data.openFeedback.toLocaleString()}
          status={data.openFeedback > 20 ? "amber" : "neutral"}
        />
        <StatusRow
          label="Blocked domains"
          value={data.blockedDomains.toLocaleString()}
          status="neutral"
        />
      </div>
    </Card>
  );
}
