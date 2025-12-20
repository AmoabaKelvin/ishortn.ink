import { api } from "@/trpc/server";

import { AddCustomDomainModal } from "./_components/add-domain-modal";
import CloudflareIssuesCard from "./_components/cloudflare-issue-card";
import { DomainCardNew } from "./_components/domain-card-new";
import EmptyState from "./_components/empty-state";

export const dynamic = "force-dynamic";

async function CustomDomainsPage() {
  const userDomains = await api.customDomain.list.query();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Custom Domains</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage and configure your custom branded domains.
          </p>
        </div>

        {userDomains.length > 0 && <AddCustomDomainModal />}
      </div>

      {userDomains.length === 0 ? (
        <div className="mt-8">
          <EmptyState />
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <CloudflareIssuesCard />

          <div className="flex flex-col gap-4">
            {userDomains.map((domain) => (
              <DomainCardNew key={domain.id} domain={domain} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomDomainsPage;
