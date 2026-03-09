import { auth } from "@clerk/nextjs/server";
import { IconBan } from "@tabler/icons-react";
import { eq } from "drizzle-orm";
import { Funnel_Sans } from "next/font/google";

import { cn } from "@/lib/utils";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";
import { ChangelogBanner } from "@/components/changelog/changelog-banner";
import { ChangelogToast } from "@/components/changelog/changelog-toast";

import { DashboardNav } from "./_components/navigation/header";
import { SidebarWrapper } from "./_components/navigation/sidebar-wrapper";
import { SignOutButton } from "./_components/sign-out-button";

interface Props {
  children: React.ReactNode;
}

const funnelSans = Funnel_Sans({
  subsets: ["latin"],
  variable: "--font-funnel-sans",
  weight: ["400", "700"],
});

export default async function DashboardLayout({ children }: Props) {
  // Check ban/admin status directly via DB, bypassing tRPC (which blocks banned users)
  const session = await auth();
  let isAdmin = false;

  if (session?.userId) {
    const currentUser = await db.query.user.findFirst({
      where: eq(user.id, session.userId),
      columns: { banned: true, bannedReason: true, isAdmin: true },
    });

    isAdmin = currentUser?.isAdmin ?? false;

    if (currentUser?.banned) {
      return (
        <div className={cn("flex min-h-screen items-center justify-center bg-neutral-50 px-4", funnelSans.className)}>
          <div className="w-full max-w-md text-center">
            <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <IconBan size={24} stroke={1.5} className="text-red-600" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
              Account Suspended
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">
              Your account has been suspended and you can no longer access the dashboard.
            </p>
            {currentUser.bannedReason && (
              <div className="mt-5 rounded-lg border border-neutral-200 bg-white px-4 py-3">
                <p className="text-[12px] font-medium text-neutral-400">Reason</p>
                <p className="mt-1 text-[13px] text-neutral-700">{currentUser.bannedReason}</p>
              </div>
            )}
            <p className="mt-6 text-[12px] text-neutral-400">
              If you believe this is a mistake, please contact us at{" "}
              <a href="mailto:support@ishortn.ink" className="text-neutral-600 underline underline-offset-2">
                support@ishortn.ink
              </a>
            </p>
            <div className="mt-8">
              <SignOutButton />
            </div>
          </div>
        </div>
      );
    }
  }

  return (
    <div className={cn("min-h-screen bg-neutral-50", funnelSans.className)}>
      {/* Changelog banner at the top */}
      <div className="fixed top-0 left-0 right-0 z-50 lg:left-[280px]">
        <ChangelogBanner />
      </div>

      <SidebarWrapper isAdmin={isAdmin} />

      {/* Main content area with left margin for sidebar */}
      <div className="lg:pl-[280px]">
        <div className="mx-auto max-w-[1180px] px-4 pt-16 pb-10 text-black sm:px-6 lg:px-8 lg:pt-10">
          <DashboardNav />
          <div className="mt-7 py-4">{children}</div>
        </div>
      </div>

      {/* Changelog toast notification */}
      <ChangelogToast />
    </div>
  );
}
