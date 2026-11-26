import { IconLock } from "@tabler/icons-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/server";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin" };

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await api.user.getProfile.query();

  // Rendered in place rather than redirect(): the dashboard shell has already
  // streamed by now, so a redirect here finishes client-side and leaves an
  // empty document in between.
  if (!profile.isAdmin) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-100 dark:bg-muted">
          <IconLock
            size={24}
            stroke={1.5}
            className="text-neutral-400 dark:text-muted-foreground"
          />
        </div>
        <h1 className="mt-6 text-[14px] font-medium text-neutral-900 dark:text-foreground">
          Admins only
        </h1>
        <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-neutral-400 dark:text-muted-foreground">
          Your account doesn&apos;t have access to the admin area.
        </p>
        <Button asChild variant="outline" className="mt-6 rounded-lg text-[13px]">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
