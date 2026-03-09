import {
  IconBan,
  IconFlag,
  IconLink,
  IconUsers,
} from "@tabler/icons-react";
import { Link } from "next-view-transitions";

import { QuickInfoCard } from "@/app/(main)/dashboard/analytics/[alias]/_components/quick-info-card";
import { Card } from "@/components/ui/card";
import { api } from "@/trpc/server";

export const dynamic = "force-dynamic";

function timeAgo(date: Date | null): string {
  if (!date) return "";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default async function AdminPage() {
  const [stats, activity] = await Promise.all([
    api.admin.getStats.query(),
    api.admin.getRecentActivity.query(),
  ]);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
          Admin Dashboard
        </h1>
        <p className="mt-1 text-[13px] text-neutral-400">
          Platform overview and moderation tools
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <QuickInfoCard
          title="Total Links"
          value={stats.totalLinks.toLocaleString()}
          icon={<IconLink size={16} stroke={1.5} className="text-blue-600" />}
        />
        <QuickInfoCard
          title="Total Users"
          value={stats.totalUsers.toLocaleString()}
          icon={<IconUsers size={16} stroke={1.5} className="text-blue-600" />}
        />
        <QuickInfoCard
          title="Blocked Links"
          value={stats.blockedLinks.toLocaleString()}
          icon={<IconBan size={16} stroke={1.5} className="text-blue-600" />}
        />
        <QuickInfoCard
          title="Pending Flags"
          value={stats.pendingFlagged.toLocaleString()}
          icon={<IconFlag size={16} stroke={1.5} className="text-blue-600" />}
        />
      </div>

      {/* Activity panels */}
      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent links */}
        <Card className="flex flex-col rounded-xl border-neutral-200 shadow-none">
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
            <p className="text-[14px] font-semibold tracking-tight text-neutral-900">
              Recent Links
            </p>
            <Link
              href="/dashboard/admin/links"
              className="text-[12px] font-medium text-neutral-400 transition-colors hover:text-neutral-600"
            >
              View all
            </Link>
          </div>
          {activity.recentLinks.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-5 py-12">
              <p className="text-[13px] text-neutral-400">No links created yet</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {activity.recentLinks.map((l) => (
                <div key={l.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-neutral-700">
                      <span className="text-neutral-400">{l.domain}/</span>
                      {l.alias}
                    </p>
                    <p className="truncate text-[11px] text-neutral-400">
                      {l.url}
                    </p>
                  </div>
                  <div className="shrink-0 pl-4 text-right">
                    <p className="text-[11px] text-neutral-400">{l.userEmail}</p>
                    <p className="text-[11px] text-neutral-300">
                      {timeAgo(l.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recently blocked */}
        <Card className="flex flex-col rounded-xl border-neutral-200 shadow-none">
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
            <p className="text-[14px] font-semibold tracking-tight text-neutral-900">
              Recently Blocked
            </p>
            <Link
              href="/dashboard/admin/links"
              className="text-[12px] font-medium text-neutral-400 transition-colors hover:text-neutral-600"
            >
              View all
            </Link>
          </div>
          {activity.recentBlocked.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-5 py-12">
              <p className="text-[13px] text-neutral-400">No blocked links</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {activity.recentBlocked.map((l) => (
                <div key={l.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-neutral-700">
                      <span className="text-neutral-400">{l.domain}/</span>
                      {l.alias}
                    </p>
                    <p className="truncate text-[11px] text-neutral-400">
                      {l.blockedReason}
                    </p>
                  </div>
                  <div className="shrink-0 pl-4 text-right">
                    <p className="text-[11px] text-neutral-400">{l.userEmail}</p>
                    <p className="text-[11px] text-neutral-300">
                      {timeAgo(l.blockedAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
