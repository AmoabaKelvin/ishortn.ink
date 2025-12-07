import { Check, Globe } from "lucide-react";

import { AddCustomDomainModal } from "./add-domain-modal";

const EmptyState = () => {
  return (
    <div className="flex min-h-[500px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center dark:border-gray-800 dark:bg-gray-900/10">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
        <Globe className="h-10 w-10 text-blue-600 dark:text-blue-400" />
      </div>

      <h3 className="mt-6 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
        No custom domains yet
      </h3>

      <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
        Add your own domain to create branded short links that build trust with your audience.
      </p>

      <div className="mt-8 space-y-3 text-left">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
            <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Brand your links with your own domain
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Use links.yourbrand.com instead of generic short links
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
            <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Increase trust and click-through rates
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Branded links get up to 39% more clicks than generic URLs
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
            <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Professional appearance for your business
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Enhance your brand identity across all marketing channels
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <AddCustomDomainModal />
      </div>
    </div>
  );
};

export default EmptyState;
