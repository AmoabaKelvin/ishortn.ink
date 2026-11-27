import { Link } from "next-view-transitions";

import { withProductUtm } from "@/lib/attribution/referral";
import { getActivePromo } from "@/lib/billing/promo";
import { getAppBaseDomain } from "@/lib/constants/domains";
import { paddlePriceId } from "@/lib/paddle/config";
import { api } from "@/trpc/server";

import { AnnualSwitchCard } from "../_components/annual-switch-card";
import { annualSwitchOffer } from "../_components/annual-switch-state";
import { getDashboardGraceNotice } from "../_lib/get-subscription";
import { SettingsNav } from "./_components/settings-nav";
import Billing from "./billing/billing";
import { CheckoutAcquisitionPrompt } from "./billing/checkout-acquisition-prompt";
import { DeleteAccountSection } from "./delete-account/delete-account-section";
import { SettingsForm } from "./general/settings-form";
import { NotificationSettings } from "./notifications/notification-settings";
import { ProfileForm } from "./profile/profile-form";
import { ApiKeys } from "./tokens/_components/api-keys";
import { ConnectedBrowsers } from "./tokens/_components/connected-browsers";
import { AccountTransferSection } from "./transfer/account-transfer-section";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Settings" };

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function SettingsPage(props: Props) {
  const [
    userSettings,
    userDomains,
    subscriptions,
    tokens,
    apiAccess,
    extensionTokens,
    userProfile,
    workspace,
    graceNotice,
    latestCheckout,
  ] = await Promise.all([
    api.siteSettings.get.query(),
    api.customDomain.list.query(),
    api.subscriptions.get.query(),
    api.token.list.query(),
    api.token.access.query(),
    api.token.listExtensions.query(),
    api.user.getProfile.query(),
    api.team.currentWorkspace.query(),
    getDashboardGraceNotice(),
    api.lemonsqueezy.latestCheckoutStart.query(),
  ]);
  // Dismissal is read on the client (annual-switch-card.tsx).
  const annualOffer = annualSwitchOffer({
    subscription: subscriptions.subscriptions ?? null,
    isTeamWorkspace: subscriptions.isTeamWorkspace,
    restricted: subscriptions.isRestricted,
    graceActive: !!graceNotice,
    otherBannerShown: false,
    dismissedAt: null,
    paddleMonthlyPriceIds: {
      pro: paddlePriceId("pro", "monthly"),
      ultra: paddlePriceId("ultra", "monthly"),
    },
  });
  // The discount code only rides on new checkouts; plan changes for subscribers are not discounted.
  const promo = subscriptions.subscriptionMode === "checkout" ? getActivePromo() : null;
  // Set by the checkout redirect (lemonsqueezy.procedure.ts).
  const { checkout } = await props.searchParams;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-[13px] text-neutral-400 dark:text-muted-foreground">
          Manage your account preferences
        </p>
      </div>

      <div className="flex gap-10">
        <SettingsNav />

        <div className="flex-1 min-w-0 space-y-12 pb-20">
          {/* Profile */}
          <section id="profile" className="scroll-mt-24">
            <h2 className="text-[14px] font-semibold text-neutral-900 dark:text-foreground">
              Profile
            </h2>
            <p className="mt-0.5 text-[12px] text-neutral-400 dark:text-muted-foreground">
              Your personal information
            </p>
            <div className="mt-4">
              <ProfileForm userProfile={userProfile} />
            </div>
          </section>

          {/* General */}
          <section id="general" className="scroll-mt-24">
            <h2 className="text-[14px] font-semibold text-neutral-900 dark:text-foreground">
              General
            </h2>
            <p className="mt-0.5 text-[12px] text-neutral-400 dark:text-muted-foreground">
              Default settings and preferences
            </p>
            <div className="mt-4">
              {/* The default domain is a personal-workspace setting; team domains can't be picked here */}
              {workspace.type === "personal" ? (
                <SettingsForm userSettings={userSettings} availableDomains={userDomains} />
              ) : (
                <div className="rounded-xl border border-neutral-200 p-5 dark:border-border">
                  <p className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                    Default Domain
                  </p>
                  <p className="mt-1 text-[12px] text-neutral-500 dark:text-neutral-400">
                    Your default domain applies to your personal workspace. Switch to your personal
                    workspace to change it.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Notifications */}
          <section id="notifications" className="scroll-mt-24">
            <h2 className="text-[14px] font-semibold text-neutral-900 dark:text-foreground">
              Notifications
            </h2>
            <p className="mt-0.5 text-[12px] text-neutral-400 dark:text-muted-foreground">
              Emails we send about your links and domains
            </p>
            <div className="mt-4">
              <NotificationSettings
                productEmailsEnabled={userProfile.productEmailsEnabled}
                weeklySummaryEnabled={userProfile.weeklySummaryEnabled}
              />
            </div>
          </section>

          {/* Billing */}
          <section id="billing" className="scroll-mt-24">
            <h2 className="text-[14px] font-semibold text-neutral-900 dark:text-foreground">
              Billing
            </h2>
            <p className="mt-0.5 text-[12px] text-neutral-400 dark:text-muted-foreground">
              Subscription and payment details
            </p>
            <div className="mt-4">
              {annualOffer && (
                <AnnualSwitchCard offer={annualOffer} source="billing" className="mb-4" />
              )}
              <Billing
                subscriptions={subscriptions}
                promo={promo}
                latestCheckout={latestCheckout}
              />
              {checkout === "success" && <CheckoutAcquisitionPrompt />}
            </div>
          </section>

          {/* API Keys */}
          <section id="api-keys" className="scroll-mt-24">
            <div className="flex items-baseline gap-2">
              <h2 className="text-[14px] font-semibold text-neutral-900 dark:text-foreground">
                API Keys
              </h2>
              <Link
                // Absolute: docs are served on the app host only, not on team subdomains.
                href={withProductUtm(
                  `https://${getAppBaseDomain()}/docs/api`,
                  "app",
                  "settings_api_docs",
                )}
                target="_blank"
                className="text-[12px] text-blue-600 dark:text-blue-400 hover:text-blue-700"
              >
                Docs
              </Link>
            </div>
            <p className="mt-0.5 text-[12px] text-neutral-400 dark:text-muted-foreground">
              Programmatic access to your account
            </p>
            <div className="mt-4">
              <ApiKeys tokens={tokens} apiAccess={apiAccess} />
            </div>
          </section>

          {/* Connected Browsers */}
          <section id="connected-browsers" className="scroll-mt-24">
            <h2 className="text-[14px] font-semibold text-neutral-900 dark:text-foreground">
              Connected Browsers
            </h2>
            <p className="mt-0.5 text-[12px] text-neutral-400 dark:text-muted-foreground">
              Browsers signed in to the iShortn extension
            </p>
            <div className="mt-4">
              <ConnectedBrowsers
                browsers={extensionTokens}
                // Absolute: docs are served on the app host only, not on team subdomains.
                docsUrl={withProductUtm(
                  `https://${getAppBaseDomain()}/docs/integrations/browser-extension`,
                  "app",
                  "settings_extension_docs",
                )}
              />
            </div>
          </section>

          {/* Account Transfer */}
          <section id="account-transfer" className="scroll-mt-24">
            <h2 className="text-[14px] font-semibold text-neutral-900 dark:text-foreground">
              Account Transfer
            </h2>
            <p className="mt-0.5 text-[12px] text-neutral-400 dark:text-muted-foreground">
              Move your resources to another user
            </p>
            <div className="mt-4">
              <AccountTransferSection />
            </div>
          </section>

          {/* Delete Account */}
          <section id="delete-account" className="scroll-mt-24">
            <h2 className="text-[14px] font-semibold text-red-600 dark:text-red-400">
              Delete Account
            </h2>
            <p className="mt-0.5 text-[12px] text-neutral-400 dark:text-muted-foreground">
              Close your account and remove your data
            </p>
            <div className="mt-4">
              <DeleteAccountSection />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
