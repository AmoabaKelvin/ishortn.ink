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

import { linkDomainOptions } from "./edit-link-form";

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
  const { shared, custom: customDomains } = linkDomainOptions(
    PLATFORM_DOMAINS,
    customDomainsQuery.data ?? [],
    currentDomain,
  );

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger aria-label="Domain" className={triggerClassName}>
        <SelectValue placeholder={currentDomain} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel className="text-[11px] font-medium text-neutral-400 dark:text-muted-foreground">
            Shared domains
          </SelectLabel>
          {shared.map((domain) => (
            <SelectItem key={domain} value={domain}>
              {domain}
            </SelectItem>
          ))}
        </SelectGroup>
        {customDomains.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-[11px] font-medium text-neutral-400 dark:text-muted-foreground">
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
