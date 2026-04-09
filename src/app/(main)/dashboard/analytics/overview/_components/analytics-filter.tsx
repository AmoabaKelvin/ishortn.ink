"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  IconChevronRight,
  IconFilter,
  IconFolder,
  IconLink,
  IconLoader2,
  IconWorld,
  IconX,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";

type FilterType = "all" | "folder" | "domain" | "link";

type ViewMode = "categories" | "items";

export function AnalyticsFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filterType = (searchParams.get("filterType") ?? "all") as FilterType;
  const filterId = searchParams.get("filterId") ?? undefined;

  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("categories");
  const [selectedCategory, setSelectedCategory] =
    useState<FilterType>("folder");

  // Fetch folders
  const { data: folders, isLoading: foldersLoading } =
    api.folder.list.useQuery(undefined, {
      enabled: open && selectedCategory === "folder",
    });

  // Fetch domains
  const { data: domains, isLoading: domainsLoading } =
    api.customDomain.list.useQuery(undefined, {
      enabled: open && selectedCategory === "domain",
    });

  // Fetch links
  const { data: linksData, isLoading: linksLoading } = api.link.list.useQuery(
    {
      page: 1,
      pageSize: 100,
      orderBy: "createdAt",
      orderDirection: "desc",
      archivedFilter: "active",
    },
    {
      enabled: open && selectedCategory === "link",
    }
  );

  // Get current filter label
  const getFilterLabel = () => {
    if (filterType === "all") return "Filter";

    if (filterType === "folder" && filterId) {
      const folder = folders?.find((f) => String(f.id) === filterId);
      return folder ? `Folder: ${folder.name}` : "Folder";
    }

    if (filterType === "domain" && filterId) {
      return `Domain: ${filterId}`;
    }

    if (filterType === "link" && filterId) {
      const link = linksData?.links.find((l) => String(l.id) === filterId);
      return link ? `Link: ${link.alias}` : "Link";
    }

    return "Filter";
  };

  const handleCategorySelect = (category: FilterType) => {
    if (category === "all") {
      applyFilter("all", undefined);
      setOpen(false);
    } else {
      setSelectedCategory(category);
      setViewMode("items");
    }
  };

  const handleItemSelect = (id: string) => {
    applyFilter(selectedCategory, id);
    setOpen(false);
    setViewMode("categories");
  };

  const applyFilter = (type: FilterType, id?: string) => {
    const params = new URLSearchParams(searchParams);

    if (type === "all") {
      params.delete("filterType");
      params.delete("filterId");
    } else {
      params.set("filterType", type);
      if (id) {
        params.set("filterId", id);
      } else {
        params.delete("filterId");
      }
    }

    router.push(`?${params.toString()}`);
  };

  const clearFilter = (e: React.MouseEvent) => {
    e.stopPropagation();
    applyFilter("all", undefined);
  };

  const categories = [
    { value: "all" as const, label: "All Analytics", icon: IconFilter },
    { value: "folder" as const, label: "Folder", icon: IconFolder },
    { value: "domain" as const, label: "Domain", icon: IconWorld },
    { value: "link" as const, label: "Link", icon: IconLink },
  ];

  const getFolderItems = () => {
    if (!folders) return [];
    return folders.map((folder) => ({
      value: String(folder.id),
      label: folder.name,
      subtitle: `${folder.linkCount} links`,
    }));
  };

  const getDomainItems = () => {
    const items = [
      { value: "ishortn.ink", label: "ishortn.ink", subtitle: "Default" },
    ];
    if (domains) {
      domains.forEach((domain) => {
        if (domain.domain) {
          items.push({
            value: domain.domain,
            label: domain.domain,
            subtitle: domain.status === "active" ? "Active" : "Pending",
          });
        }
      });
    }
    return items;
  };

  const getLinkItems = () => {
    if (!linksData?.links) return [];
    return linksData.links.map((link) => ({
      value: String(link.id),
      label: `${link.domain}/${link.alias}`,
      subtitle: link.name || "",
    }));
  };

  const getCurrentItems = () => {
    if (selectedCategory === "folder") return getFolderItems();
    if (selectedCategory === "domain") return getDomainItems();
    if (selectedCategory === "link") return getLinkItems();
    return [];
  };

  const isLoading =
    (selectedCategory === "folder" && foldersLoading) ||
    (selectedCategory === "domain" && domainsLoading) ||
    (selectedCategory === "link" && linksLoading);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset to categories view when closing
      setTimeout(() => setViewMode("categories"), 150);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-full justify-between gap-2 border-neutral-200 dark:border-border bg-white dark:bg-card px-3 text-[13px] sm:w-[240px]"
        >
          <div className="flex min-w-0 items-center gap-2">
            <IconFilter size={14} stroke={1.5} className="shrink-0 text-neutral-400 dark:text-neutral-500" />
            <span className="truncate font-medium">{getFilterLabel()}</span>
          </div>
          {filterType !== "all" ? (
            <IconX
              size={14}
              stroke={1.5}
              className="shrink-0 text-neutral-400 dark:text-neutral-500 transition-colors hover:text-neutral-600 dark:hover:text-neutral-300"
              onClick={clearFilter}
            />
          ) : (
            <IconChevronRight size={14} stroke={1.5} className="shrink-0 text-neutral-400 dark:text-neutral-500" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] rounded-lg border-neutral-200 dark:border-border p-0" align="start">
        <Command>
          {viewMode === "items" && (
            <CommandInput
              placeholder={`Search ${selectedCategory}...`}
              className="h-9"
            />
          )}

          <CommandList className="max-h-[300px]">
            {viewMode === "categories" ? (
              <CommandGroup className="p-1.5">
                {categories.map((category) => {
                  const Icon = category.icon;
                  return (
                    <CommandItem
                      key={category.value}
                      value={category.value}
                      onSelect={() => handleCategorySelect(category.value)}
                      className="flex items-center justify-between rounded-md px-3 py-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon size={14} stroke={1.5} className="text-neutral-400 dark:text-neutral-500" />
                        <span className="text-[13px] font-medium">{category.label}</span>
                      </div>
                      {category.value !== "all" && (
                        <IconChevronRight size={14} stroke={1.5} className="text-neutral-400 dark:text-neutral-500" />
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : (
              <>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <IconLoader2 size={18} stroke={1.5} className="animate-spin text-neutral-400 dark:text-neutral-500" />
                  </div>
                ) : (
                  <>
                    <CommandEmpty className="py-8 text-[13px] text-neutral-400 dark:text-neutral-500">No {selectedCategory} found.</CommandEmpty>
                    <CommandGroup className="p-1.5">
                      {getCurrentItems().map((item) => (
                        <CommandItem
                          key={item.value}
                          value={item.value}
                          onSelect={handleItemSelect}
                          className="rounded-md px-3 py-2"
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[13px] font-medium">{item.label}</span>
                            {item.subtitle && (
                              <span className="text-[12px] text-neutral-400 dark:text-neutral-500">
                                {item.subtitle}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
