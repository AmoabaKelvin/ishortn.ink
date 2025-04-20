import { Separator } from "@/components/ui/separator";
import { api } from "@/trpc/server";

import { AddCustomDomainModal } from "./_components/add-domain-modal";
import ListDomains from "./_components/domains";
import EmptyState from "./_components/empty-state";

export const dynamic = "force-dynamic";

async function CustomDomainsPage() {
  const userDomains = await api.customDomain.list.query();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Custom Domains</h1>
          <p className="mt-2 text-gray-500">Manage your custom domains.</p>
        </div>
        <AddCustomDomainModal />
      </div>
      <Separator />
      {userDomains.length === 0 ? (
        <EmptyState />
      ) : (
        <ListDomains domains={userDomains} />
      )}
    </div>
  );
}

export default CustomDomainsPage;
