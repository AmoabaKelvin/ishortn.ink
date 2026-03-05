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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
            Custom Domains
          </h1>
          {userDomains.length > 0 && (
            <p className="mt-1 text-[13px] text-neutral-400">
              {userDomains.length}{" "}
              {userDomains.length === 1 ? "domain" : "domains"} total
            </p>
          )}
        </div>

        {userDomains.length > 0 && <AddCustomDomainModal />}
      </div>

      {userDomains.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          <CloudflareIssuesCard />

          <div className="divide-y divide-neutral-300/60">
            {userDomains.map((domain, index) => (
              <DomainCardNew key={domain.id} domain={domain} index={index} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomDomainsPage;
