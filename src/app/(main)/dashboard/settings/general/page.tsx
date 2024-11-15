import { SettingsForm } from "@/app/(main)/dashboard/settings/general/settings-form";
import { Separator } from "@/components/ui/separator";
import { api } from "@/trpc/server";

async function GeneralSettingsPage() {
  const [userSettings, userDomains] = await Promise.all([
    api.siteSettings.get.query(),
    api.customDomain.list.query(),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">General Settings</h1>
          <p className="mt-2 text-gray-500">Manage your account settings.</p>
        </div>
      </div>
      <Separator />
      <div className="grid gap-8 mt-8">
        <SettingsForm
          userSettings={userSettings}
          availableDomains={userDomains}
        />
      </div>
    </div>
  );
}

export default GeneralSettingsPage;
