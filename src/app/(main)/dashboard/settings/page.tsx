import { CreditCard, Key, Settings } from "lucide-react";
import { Link } from "next-view-transitions";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { api } from "@/trpc/server";

import Billing from "./billing/billing";
import { SettingsForm } from "./general/settings-form";
import GenerateTokenTrigger from "./tokens/_components/create-token";
import TokenCard from "./tokens/_components/token-card";

export const dynamic = "force-dynamic";

async function SettingsPage() {
  const [userSettings, userDomains, subscriptions, tokens] = await Promise.all([
    api.siteSettings.get.query(),
    api.customDomain.list.query(),
    api.subscriptions.get.query(),
    api.token.list.query(),
  ]);

  const token = tokens[0];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
          Settings
        </h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          Manage your account settings and preferences.
        </p>
      </div>

      <Separator />

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            API Keys
          </TabsTrigger>
        </TabsList>

        {/* General Settings Tab */}
        <TabsContent value="general" className="space-y-6">
          <SettingsForm
            userSettings={userSettings}
            availableDomains={userDomains}
          />
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-6">
          <Billing subscriptions={subscriptions} />
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api-keys" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Manage API keys for programmatic access.{" "}
                <Link
                  href="https://ishortn.mintlify.app/introduction"
                  target="_blank"
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  View Documentation →
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-3xl">
                {tokens.length > 0 ? (
                  <TokenCard
                    start="******"
                    createdAt={token!.createdAt!.getTime()}
                    keyID={token!.id}
                  />
                ) : (
                  <GenerateTokenTrigger />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default SettingsPage;
