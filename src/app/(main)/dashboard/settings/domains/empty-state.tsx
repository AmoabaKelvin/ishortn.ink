import { PackageSearch } from "lucide-react";

import { AddCustomDomainModal } from "./add-domain-modal";

const EmptyState = () => {
  return (
    <div className="flex flex-col items-center justify-center md:mt-20">
      <PackageSearch className="h-24 w-24 text-gray-300" />
      <h2 className="mt-4 text-lg font-medium">No custom domains</h2>
      <AddCustomDomainModal />
    </div>
  );
};

export default EmptyState;
