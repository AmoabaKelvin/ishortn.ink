"use client";

import { IconChevronDown, IconChevronUp, IconTable } from "@tabler/icons-react";
import { useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { formatChartMonth } from "@/lib/utils";

type MonthlyRow = {
  month: string;
  links: number;
  users: number;
  clicks: number;
};

type SortKey = "month" | "links" | "users" | "clicks";
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) {
    return (
      <IconChevronDown size={12} stroke={1.5} className="text-neutral-300" />
    );
  }
  return dir === "asc" ? (
    <IconChevronUp size={12} stroke={2} className="text-neutral-700" />
  ) : (
    <IconChevronDown size={12} stroke={2} className="text-neutral-700" />
  );
}

type MonthlyBreakdownCardProps = {
  data: MonthlyRow[] | undefined;
  isLoading: boolean;
};

export function MonthlyBreakdownCard({
  data,
  isLoading,
}: MonthlyBreakdownCardProps) {
  const [sortKey, setSortKey] = useState<SortKey>("month");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc"
          ? av.localeCompare(bv)
          : bv.localeCompare(av);
      }
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
  }, [data, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const columns: { key: SortKey; label: string; align: string }[] = [
    { key: "month", label: "Month", align: "text-left" },
    { key: "links", label: "Links", align: "text-right" },
    { key: "users", label: "Users", align: "text-right" },
    { key: "clicks", label: "Clicks", align: "text-right" },
  ];

  return (
    <Card className="rounded-xl border-neutral-200 shadow-none">
      <div className="flex items-center gap-2 border-b border-neutral-100 px-5 py-4">
        <IconTable size={15} stroke={1.5} className="text-neutral-400" />
        <p className="text-[14px] font-semibold tracking-tight text-neutral-900">
          Monthly Breakdown
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center px-5 py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-400" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex items-center justify-center px-5 py-12">
          <p className="text-[13px] text-neutral-400">No data for this period</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-100">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-5 py-2.5 ${col.align}`}
                    aria-sort={
                      sortKey === col.key
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-neutral-400 transition-colors hover:text-neutral-600"
                    >
                      {col.label}
                      <SortIcon
                        active={sortKey === col.key}
                        dir={sortDir}
                      />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {sorted.map((row) => (
                <tr
                  key={row.month}
                  className="transition-colors hover:bg-neutral-50/50"
                >
                  <td className="px-5 py-2.5 text-[13px] font-medium text-neutral-700">
                    {formatChartMonth(row.month)}
                  </td>
                  <td className="px-5 py-2.5 text-right text-[13px] tabular-nums text-neutral-600">
                    {row.links.toLocaleString()}
                  </td>
                  <td className="px-5 py-2.5 text-right text-[13px] tabular-nums text-neutral-600">
                    {row.users.toLocaleString()}
                  </td>
                  <td className="px-5 py-2.5 text-right text-[13px] tabular-nums text-neutral-600">
                    {row.clicks.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
