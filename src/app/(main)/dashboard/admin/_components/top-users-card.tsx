"use client";

import { IconTrophy } from "@tabler/icons-react";
import { useState } from "react";

import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/trpc/react";

type TopUsersCardProps = {
  from: Date;
  to: Date;
};

export function TopUsersCard({ from, to }: TopUsersCardProps) {
  const [sortBy, setSortBy] = useState<"links" | "clicks">("links");

  const { data, isLoading } = api.admin.getTopUsers.useQuery({
    from,
    to,
    sortBy,
    limit: 10,
  });

  return (
    <Card className="flex flex-col rounded-xl border-neutral-200 dark:border-border shadow-none">
      <div className="flex items-center justify-between border-b border-neutral-100 dark:border-border/50 px-5 py-4">
        <div className="flex items-center gap-2">
          <IconTrophy size={15} stroke={1.5} className="text-amber-500 dark:text-amber-400" />
          <p className="text-[14px] font-semibold tracking-tight text-neutral-900 dark:text-foreground">
            Top Users
          </p>
        </div>
        <Select
          value={sortBy}
          onValueChange={(v) => setSortBy(v as "links" | "clicks")}
        >
          <SelectTrigger className="h-7 w-[110px] rounded-lg text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="links">By Links</SelectItem>
            <SelectItem value="clicks">By Clicks</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center px-5 py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-200 dark:border-border border-t-neutral-400 dark:border-t-neutral-500" />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-5 py-12">
          <p className="text-[13px] text-neutral-400 dark:text-neutral-500">No data for this period</p>
        </div>
      ) : (
        <div className="divide-y divide-neutral-100 dark:divide-border/50">
          {data.map((u, i) => (
            <div
              key={u.id}
              className="flex items-center gap-3 px-5 py-2.5"
            >
              <span className="w-5 shrink-0 text-center text-[11px] font-semibold tabular-nums text-neutral-300 dark:text-neutral-600">
                {i + 1}
              </span>
              {u.imageUrl ? (
                <img
                  src={u.imageUrl}
                  alt=""
                  className="h-7 w-7 shrink-0 rounded-full bg-neutral-100 dark:bg-muted object-cover"
                />
              ) : (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-muted text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                  {(u.name ?? u.email ?? "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                  {u.name ?? "Unnamed"}
                </p>
                <p className="truncate text-[11px] text-neutral-400 dark:text-neutral-500">
                  {u.email}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[12px] font-semibold tabular-nums text-neutral-700 dark:text-neutral-300">
                  {sortBy === "clicks"
                    ? u.clickCount.toLocaleString()
                    : u.linkCount.toLocaleString()}
                </p>
                <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
                  {sortBy === "clicks" ? "clicks" : "links"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
