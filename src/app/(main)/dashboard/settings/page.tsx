import { Link } from "next-view-transitions";

import { api } from "@/trpc/server";

import Billing from "./billing/billing";
import { SettingsForm } from "./general/settings-form";
import { ProfileForm } from "./profile/profile-form";
import GenerateTokenTrigger from "./tokens/_components/create-token";
import TokenCard from "./tokens/_components/token-card";
import { AccountTransferSection } from "./transfer/account-transfer-section";
import { SettingsNav } from "./_components/settings-nav";

export const dynamic = "force-dynamic";

async function SettingsPage() {
  const [userSettings, userDomains, subscriptions, tokens, userProfile] =
    await Promise.all([
      api.siteSettings.get.query(),
      api.customDomain.list.query(),
      api.subscriptions.get.query(),
      api.token.list.query(),
      api.user.getProfile.query(),
    ]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
          Settings
        </h1>
        <p className="mt-1 text-[13px] text-neutral-400">
          Manage your account preferences
        </p>
      </div>

      <div className="flex gap-10">
        <SettingsNav />

        <div className="flex-1 min-w-0 space-y-12 pb-20">
          {/* Profile */}
          <section id="profile" className="scroll-mt-24">
            <h2 className="text-[14px] font-semibold text-neutral-900">
              Profile
            </h2>
            <p className="mt-0.5 text-[12px] text-neutral-400">
              Your personal information
            </p>
            <div className="mt-4">
              <ProfileForm userProfile={userProfile} />
            </div>
          </section>

          {/* General */}
          <section id="general" className="scroll-mt-24">
            <h2 className="text-[14px] font-semibold text-neutral-900">
              General
            </h2>
            <p className="mt-0.5 text-[12px] text-neutral-400">
              Default settings and preferences
            </p>
            <div className="mt-4">
              <SettingsForm
                userSettings={userSettings}
                availableDomains={userDomains}
              />
            </div>
          </section>

          {/* Billing */}
          <section id="billing" className="scroll-mt-24">
            <h2 className="text-[14px] font-semibold text-neutral-900">
              Billing
            </h2>
            <p className="mt-0.5 text-[12px] text-neutral-400">
              Subscription and payment details
            </p>
            <div className="mt-4">
              <Billing subscriptions={subscriptions} />
            </div>
          </section>

          {/* API Keys */}
          <section id="api-keys" className="scroll-mt-24">
            <div className="flex items-baseline gap-2">
              <h2 className="text-[14px] font-semibold text-neutral-900">
                API Keys
              </h2>
              <Link
                href="https://ishortn.mintlify.app/introduction"
                target="_blank"
                className="text-[12px] text-blue-600 hover:text-blue-700"
              >
                Docs
              </Link>
            </div>
            <p className="mt-0.5 text-[12px] text-neutral-400">
              Programmatic access to your account
            </p>
            <div className="mt-4">
              {tokens.length > 0 && tokens[0] ? (
                <TokenCard
                  start="******"
                  createdAt={tokens[0].createdAt?.getTime() ?? Date.now()}
                  keyID={tokens[0].id}
                />
              ) : (
                <GenerateTokenTrigger />
              )}
            </div>
          </section>

          {/* Account Transfer */}
          <section id="account-transfer" className="scroll-mt-24">
            <h2 className="text-[14px] font-semibold text-neutral-900">
              Account Transfer
            </h2>
            <p className="mt-0.5 text-[12px] text-neutral-400">
              Move your resources to another user
            </p>
            <div className="mt-4">
              <AccountTransferSection />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
