import { ROLE_PERMISSIONS } from "@/server/lib/workspace/types";
import { api } from "@/trpc/server";

import { AddCustomDomainModal } from "./_components/add-domain-modal";
import CloudflareIssuesCard from "./_components/cloudflare-issue-card";
import { DomainCardNew } from "./_components/domain-card-new";
import { DomainMigrationBanner } from "./_components/domain-migration-banner";
import EmptyState from "./_components/empty-state";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Domains" };

export const dynamic = "force-dynamic";

async function CustomDomainsPage() {
  const [userDomains, workspace] = await Promise.all([
    api.customDomain.list.query(),
    api.team.currentWorkspace.query(),
  ]);

  // Mirrors the server's domains.create / domains.delete checks so team
  // members don't see actions that would only fail
  const canManageDomains =
    workspace.type === "personal" ||
    ROLE_PERMISSIONS[workspace.role].some((permission) => permission === "domains.create");

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
            Custom Domains
          </h1>
          {userDomains.length > 0 && (
            <p className="mt-1 text-[13px] text-neutral-400 dark:text-muted-foreground">
              {userDomains.length} {userDomains.length === 1 ? "domain" : "domains"} total
            </p>
          )}
        </div>

        {userDomains.length > 0 && canManageDomains && <AddCustomDomainModal />}
      </div>

      {userDomains.length === 0 ? (
        <EmptyState canManageDomains={canManageDomains} />
      ) : (
        <div className="space-y-6">
          <DomainMigrationBanner />

          <CloudflareIssuesCard />

          <div className="divide-y divide-neutral-300/60 dark:divide-border">
            {userDomains.map((domain, index) => (
              <DomainCardNew
                key={domain.id}
                domain={domain}
                index={index}
                canManageDomains={canManageDomains}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomDomainsPage;
