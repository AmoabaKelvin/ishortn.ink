import { Link } from "next-view-transitions";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { api } from "@/trpc/server";

import Billing from "./billing/billing";
import { SettingsForm } from "./general/settings-form";
import { ProfileForm } from "./profile/profile-form";
import GenerateTokenTrigger from "./tokens/_components/create-token";
import TokenCard from "./tokens/_components/token-card";
import { AccountTransferSection } from "./transfer/account-transfer-section";

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
    <div className="space-y-10">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
          Settings
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Manage your account settings and preferences.
        </p>
      </div>

      <Separator />

      {/* Profile Section */}
      <section id="profile" className="scroll-mt-20 space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Profile</h2>
          <p className="text-sm text-muted-foreground">
            Manage your personal information.
          </p>
        </div>
        <ProfileForm userProfile={userProfile} />
      </section>

      <Separator />

      {/* General Settings Section */}
      <section id="general" className="scroll-mt-20 space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">General</h2>
          <p className="text-sm text-muted-foreground">
            Configure your default settings.
          </p>
        </div>
        <SettingsForm
          userSettings={userSettings}
          availableDomains={userDomains}
        />
      </section>

      <Separator />

      {/* Billing Section */}
      <section id="billing" className="scroll-mt-20 space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Billing</h2>
          <p className="text-sm text-muted-foreground">
            Manage your subscription and billing information.
          </p>
        </div>
        <Billing subscriptions={subscriptions} />
      </section>

      <Separator />

      {/* API Keys Section */}
      <section id="api-keys" className="scroll-mt-20 space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">API Keys</h2>
          <p className="text-sm text-muted-foreground">
            Manage API keys for programmatic access.{" "}
            <Link
              href="https://ishortn.mintlify.app/introduction"
              target="_blank"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              View Documentation →
            </Link>
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Your API Key</CardTitle>
            <CardDescription>
              Use this key to authenticate API requests.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-3xl">
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
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* Account Transfer Section */}
      <section id="account-transfer" className="scroll-mt-20 space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">
            Account Transfer
          </h2>
          <p className="text-sm text-muted-foreground">
            Transfer your account and all resources to another user.
          </p>
        </div>
        <AccountTransferSection />
      </section>
    </div>
  );
}

export default SettingsPage;
