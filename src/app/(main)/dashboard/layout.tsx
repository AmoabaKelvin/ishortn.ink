import { auth } from "@clerk/nextjs/server";
import { IconAlertTriangle, IconBan, IconTrash } from "@tabler/icons-react";
import { Funnel_Sans } from "next/font/google";

import { ChangelogBanner } from "@/components/changelog/changelog-banner";
import { purgeDateFor } from "@/lib/account-deletion/constants";
import { cn } from "@/lib/utils";
import { displayName } from "@/lib/utils/user-name";
import { ensureUser } from "@/server/lib/ensure-user";
import { hasBouncedEmail } from "@/server/lib/notifications/suppression";

import { AnnualSwitchCard } from "./_components/annual-switch-card";
import { annualSwitchOffer } from "./_components/annual-switch-state";
import { AttributionRecorder } from "./_components/attribution-recorder";
import { BouncedEmailBanner } from "./_components/bounced-email-banner";
import { DomainMigrationGate } from "./_components/domain-migration-gate";
import { DashboardNav } from "./_components/navigation/header";
import { SidebarWrapper } from "./_components/navigation/sidebar-wrapper";
import { PlanGraceBanner } from "./_components/plan-grace-banner";
import { PromoBanner } from "./_components/promo-banner";
import { promoBannerState, upgradeOfferPromo } from "./_components/promo-banner-state";
import { RestoreAccountButton } from "./_components/restore-account-button";
import { SignOutButton } from "./_components/sign-out-button";
import { trackingPausedBannerState } from "./_components/tracking-paused";
import { TrackingPausedBanner } from "./_components/tracking-paused-banner";
import { UpgradeOfferProvider } from "./_components/upgrade-offer";
import { getDashboardGraceNotice, getDashboardSubscription } from "./_lib/get-subscription";

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
  let isRestricted = false;
  let userName: string | null = null;
  let emailBounced = false;

  if (session?.userId) {
    // Parallel so the banner check adds no round trip; it only hides the banner if it fails.
    const [currentUser, bounced] = await Promise.all([
      ensureUser(session.userId),
      hasBouncedEmail(session.userId).catch(() => false),
    ]);
    emailBounced = bounced;

    isAdmin = currentUser?.isAdmin ?? false;
    isRestricted = !!currentUser?.restrictedAt;
    userName = displayName(currentUser?.name);

    if (currentUser?.banned) {
      return (
        <div
          className={cn(
            "flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-accent/50 px-4",
            funnelSans.className,
          )}
        >
          <div className="w-full max-w-md text-center">
            <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10">
              <IconBan size={24} stroke={1.5} className="text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
              Account Suspended
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400">
              Your account has been suspended and you can no longer access the dashboard.
            </p>
            {currentUser.bannedReason && (
              <div className="mt-5 rounded-lg border border-neutral-200 dark:border-border bg-white dark:bg-card px-4 py-3">
                <p className="text-[12px] font-medium text-neutral-400 dark:text-muted-foreground">
                  Reason
                </p>
                <p className="mt-1 text-[13px] text-neutral-700 dark:text-neutral-300">
                  {currentUser.bannedReason}
                </p>
              </div>
            )}
            <p className="mt-6 text-[12px] text-neutral-400 dark:text-muted-foreground">
              If you believe this is a mistake, please contact us at{" "}
              <a
                href="mailto:support@ishortn.ink"
                className="text-neutral-600 dark:text-neutral-400 underline underline-offset-2"
              >
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

    if (currentUser?.deletedAt) {
      const purgeAt = purgeDateFor(currentUser.deletedAt);
      const canRestore = purgeAt > new Date();

      return (
        <div
          className={cn(
            "flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-accent/50 px-4",
            funnelSans.className,
          )}
        >
          <div className="w-full max-w-md text-center">
            <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/10">
              <IconTrash size={24} stroke={1.5} className="text-amber-600 dark:text-amber-400" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
              Account scheduled for deletion
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400">
              Your links and bio pages have stopped working. Everything is permanently deleted on{" "}
              {purgeAt.toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
              .
            </p>
            {canRestore && (
              <p className="mt-4 text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                Changed your mind? Restore it and your links, bio pages, and analytics come back. A
                paid subscription stays cancelled — you&apos;d need to subscribe again.
              </p>
            )}
            <div className="mt-6 flex flex-col items-center gap-3">
              {canRestore && <RestoreAccountButton />}
              <SignOutButton />
            </div>
          </div>
        </div>
      );
    }
  }

  // Fetched after ensureUser so a just-provisioned user has a row. The sidebar reads the same
  // cache() entry, so the paused-tracking banner adds no query. The grace notice is fetched
  // alongside so its banner is in the first render instead of shifting the page after hydration.
  const [subscription, graceNotice] = session?.userId
    ? await Promise.all([getDashboardSubscription(), getDashboardGraceNotice()])
    : [null, undefined];
  const trackingPaused = trackingPausedBannerState(subscription);
  const promo = promoBannerState({
    subscription,
    otherBannerShown: isRestricted || emailBounced || !!trackingPaused || !!graceNotice,
  });
  const upgradeOffer = upgradeOfferPromo({ subscription, isRestricted });
  // Dismissal is read on the client (annual-switch-card.tsx).
  const annualOffer = annualSwitchOffer({
    subscription: subscription?.subscriptions ?? null,
    isTeamWorkspace: subscription?.isTeamWorkspace ?? false,
    restricted: isRestricted,
    graceActive: !!graceNotice,
    otherBannerShown: emailBounced || !!trackingPaused || !!promo,
    dismissedAt: null,
  });

  return (
    <UpgradeOfferProvider promo={upgradeOffer}>
      <div className={cn("min-h-screen bg-neutral-50 dark:bg-accent/50", funnelSans.className)}>
        <SidebarWrapper isAdmin={isAdmin} userName={userName} />

        {/* Main content area with left margin for sidebar */}
        <div className="lg:pl-[280px]">
          <ChangelogBanner />
          <div className="mx-auto max-w-[1180px] px-4 pt-6 pb-10 text-black dark:text-foreground sm:px-6 lg:px-8 lg:pt-10">
            <DashboardNav />
            {isRestricted && (
              <div className="mt-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-700 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
                <IconAlertTriangle size={16} stroke={1.5} className="mt-0.5 shrink-0" />
                <p className="min-w-0">
                  Your account is restricted. Contact{" "}
                  <a
                    href="mailto:safety@ishortn.ink"
                    className="font-medium underline underline-offset-2 hover:text-amber-800 dark:hover:text-amber-300"
                  >
                    safety@ishortn.ink
                  </a>
                </p>
              </div>
            )}
            {emailBounced && <BouncedEmailBanner />}
            {trackingPaused && <TrackingPausedBanner {...trackingPaused} />}
            {promo && <PromoBanner promo={promo} />}
            {annualOffer && (
              <AnnualSwitchCard offer={annualOffer} source="dashboard" className="mt-6" />
            )}
            <div className="mt-7 py-4">
              <PlanGraceBanner initialNotice={graceNotice} />
              {children}
            </div>
          </div>
        </div>

        <DomainMigrationGate />

        <AttributionRecorder />
      </div>
    </UpgradeOfferProvider>
  );
}
