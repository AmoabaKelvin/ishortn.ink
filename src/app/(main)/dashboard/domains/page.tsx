import { api } from "@/trpc/server";

import { AddCustomDomainModal } from "./_components/add-domain-modal";
import CloudflareIssuesCard from "./_components/cloudflare-issue-card";
import { DomainCardNew } from "./_components/domain-card-new";
import EmptyState from "./_components/empty-state";

export const dynamic = "force-dynamic";

async function CustomDomainsPage() {
  const userDomains = await api.customDomain.list.query();

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
            Custom Domains
          </h1>
          <p className="text-gray-500 mt-2 text-lg dark:text-gray-400">
            Manage and configure your custom branded domains.
          </p>
        </div>

        {userDomains.length > 0 && <AddCustomDomainModal />}
      </div>

      {/* Content */}
      {userDomains.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          <CloudflareIssuesCard />

          <div className="flex flex-col gap-4">
            {userDomains.map((domain) => (
              <DomainCardNew key={domain.id} domain={domain} />
            ))}
          </div>

          {/* <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
            <AlertDescription className="text-sm text-blue-900 dark:text-blue-200">
              <span className="font-medium">Note:</span> DNS propagation may take up to 48 hours.
              If you've configured your DNS records correctly, use the "Check Now" button to verify your domain status.
            </AlertDescription>
          </Alert> */}
        </div>
      )}
    </div>
  );
}

export default CustomDomainsPage;
