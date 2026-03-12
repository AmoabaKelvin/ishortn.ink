"use client";

import { Card } from "@/components/ui/card";
import { formatChartDate, formatChartMonth } from "@/lib/utils";

type PeakPeriod = { date?: string; month?: string; count: number };

type PeakData = {
  peakLinkDay: PeakPeriod | null;
  peakUserDay: PeakPeriod | null;
  peakClickDay: PeakPeriod | null;
  peakLinkMonth: PeakPeriod | null;
  peakUserMonth: PeakPeriod | null;
};

function PeakRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <span className="text-[13px] text-neutral-600">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-neutral-400">{detail}</span>
        <span className="min-w-[2rem] text-right text-[13px] font-semibold tabular-nums text-neutral-900">
          {value}
        </span>
      </div>
    </div>
  );
}

type PeakPeriodsCardProps = {
  data: PeakData | undefined;
  isLoading: boolean;
};

export function PeakPeriodsCard({ data, isLoading }: PeakPeriodsCardProps) {
  if (isLoading) {
    return (
      <Card className="rounded-xl border-neutral-200 shadow-none">
        <div className="border-b border-neutral-100 px-5 py-4">
          <p className="text-[14px] font-semibold tracking-tight text-neutral-900">
            Peak Periods
          </p>
        </div>
        <div className="flex items-center justify-center px-5 py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-400" />
        </div>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="rounded-xl border-neutral-200 shadow-none">
        <div className="border-b border-neutral-100 px-5 py-4">
          <p className="text-[14px] font-semibold tracking-tight text-neutral-900">
            Peak Periods
          </p>
        </div>
        <div className="flex items-center justify-center px-5 py-12">
          <p className="text-[13px] text-neutral-400">Failed to load data</p>
        </div>
      </Card>
    );
  }

  const hasAnyData =
    data.peakLinkDay?.date ||
    data.peakUserDay?.date ||
    data.peakClickDay?.date ||
    data.peakLinkMonth?.month ||
    data.peakUserMonth?.month;

  return (
    <Card className="rounded-xl border-neutral-200 shadow-none">
      <div className="border-b border-neutral-100 px-5 py-4">
        <p className="text-[14px] font-semibold tracking-tight text-neutral-900">
          Peak Periods
        </p>
        <p className="mt-0.5 text-[12px] text-neutral-400">
          Busiest days and months in range
        </p>
      </div>
      {!hasAnyData ? (
        <div className="flex items-center justify-center px-5 py-12">
          <p className="text-[13px] text-neutral-400">No data for this period</p>
        </div>
      ) : (
        <div className="divide-y divide-neutral-100">
          {data.peakLinkDay?.date && (
            <PeakRow
              label="Most links (day)"
              value={data.peakLinkDay.count.toLocaleString()}
              detail={formatChartDate(data.peakLinkDay.date)}
            />
          )}
          {data.peakUserDay?.date && (
            <PeakRow
              label="Most signups (day)"
              value={data.peakUserDay.count.toLocaleString()}
              detail={formatChartDate(data.peakUserDay.date)}
            />
          )}
          {data.peakClickDay?.date && (
            <PeakRow
              label="Most clicks (day)"
              value={data.peakClickDay.count.toLocaleString()}
              detail={formatChartDate(data.peakClickDay.date)}
            />
          )}
          {data.peakLinkMonth?.month && (
            <PeakRow
              label="Most links (month)"
              value={data.peakLinkMonth.count.toLocaleString()}
              detail={formatChartMonth(data.peakLinkMonth.month)}
            />
          )}
          {data.peakUserMonth?.month && (
            <PeakRow
              label="Most signups (month)"
              value={data.peakUserMonth.count.toLocaleString()}
              detail={formatChartMonth(data.peakUserMonth.month)}
            />
          )}
        </div>
      )}
    </Card>
  );
}
