"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PLATFORM_DOMAINS } from "@/lib/constants/domains";
import { api } from "@/trpc/react";

type LinkDomainSelectProps = {
  value: string;
  onValueChange: (domain: string) => void;
  /** The domain the link is on now; listed even if it is no longer verified. */
  currentDomain: string;
  triggerClassName?: string;
};

/** Domain picker for an existing link: shared domains and the workspace's verified ones. */
export function LinkDomainSelect({
  value,
  onValueChange,
  currentDomain,
  triggerClassName,
}: LinkDomainSelectProps) {
  const customDomainsQuery = api.customDomain.list.useQuery();
  const customDomains = (customDomainsQuery.data ?? []).flatMap((domain) =>
    domain.status === "active" && domain.domain ? [domain.domain] : [],
  );
  const known = new Set([...PLATFORM_DOMAINS, ...customDomains].map((d) => d.toLowerCase()));
  if (!known.has(currentDomain.toLowerCase())) customDomains.unshift(currentDomain);

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger aria-label="Domain" className={triggerClassName}>
        <SelectValue placeholder={currentDomain} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
            Shared domains
          </SelectLabel>
          {PLATFORM_DOMAINS.map((domain) => (
            <SelectItem key={domain} value={domain}>
              {domain}
            </SelectItem>
          ))}
        </SelectGroup>
        {customDomains.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
              Your domains
            </SelectLabel>
            {customDomains.map((domain) => (
              <SelectItem key={domain} value={domain} className="break-all">
                {domain}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}
