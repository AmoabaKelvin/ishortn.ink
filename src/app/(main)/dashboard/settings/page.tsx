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
  const [userSettings, userDomains, subscriptions, tokens, userProfile] = await Promise.all([
    api.siteSettings.get.query(),
    api.customDomain.list.query(),
    api.subscriptions.get.query(),
    api.token.list.query(),
    api.user.getProfile.query(),
  ]);

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 px-8 py-12 mb-10">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 256 256%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E')] opacity-[0.03]" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative">
          <p className="text-amber-400/80 text-sm font-medium tracking-wide uppercase mb-2">
            Account
          </p>
          <h1 className="font-display text-4xl md:text-5xl text-white tracking-tight">
            Settings
          </h1>
          <p className="text-neutral-400 mt-3 max-w-lg">
            Manage your profile, preferences, billing, and account security all in one place.
          </p>
        </div>
      </div>

      <div className="flex gap-10">
        {/* Sidebar Navigation */}
        <SettingsNav />

        {/* Main Content */}
        <div className="flex-1 min-w-0 space-y-16 pb-20">
          {/* Profile Section */}
          <section id="profile" className="scroll-mt-24">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 text-amber-700">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
              </div>
              <div>
                <h2 className="font-display text-2xl text-neutral-900">Profile</h2>
                <p className="text-sm text-neutral-500">Your personal information</p>
              </div>
            </div>
            <ProfileForm userProfile={userProfile} />
          </section>

          {/* General Section */}
          <section id="general" className="scroll-mt-24">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              </div>
              <div>
                <h2 className="font-display text-2xl text-neutral-900">General</h2>
                <p className="text-sm text-neutral-500">Default settings and preferences</p>
              </div>
            </div>
            <SettingsForm
              userSettings={userSettings}
              availableDomains={userDomains}
            />
          </section>

          {/* Billing Section */}
          <section id="billing" className="scroll-mt-24">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-700">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
                </svg>
              </div>
              <div>
                <h2 className="font-display text-2xl text-neutral-900">Billing</h2>
                <p className="text-sm text-neutral-500">Subscription and payment details</p>
              </div>
            </div>
            <Billing subscriptions={subscriptions} />
          </section>

          {/* API Keys Section */}
          <section id="api-keys" className="scroll-mt-24">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 text-violet-700">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
                </svg>
              </div>
              <div>
                <h2 className="font-display text-2xl text-neutral-900">API Keys</h2>
                <p className="text-sm text-neutral-500">
                  Programmatic access to your account.{" "}
                  <Link
                    href="https://ishortn.mintlify.app/introduction"
                    target="_blank"
                    className="text-amber-600 hover:text-amber-700 transition-colors"
                  >
                    View docs →
                  </Link>
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
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

          {/* Account Transfer Section */}
          <section id="account-transfer" className="scroll-mt-24">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-rose-100 to-pink-100 text-rose-700">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
              </div>
              <div>
                <h2 className="font-display text-2xl text-neutral-900">Account Transfer</h2>
                <p className="text-sm text-neutral-500">Move your account to another user</p>
              </div>
            </div>
            <AccountTransferSection />
          </section>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
