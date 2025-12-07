"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronRight,
  Filter,
  FolderIcon,
  Globe,
  Link2,
  Loader2,
  X,
} from "lucide-react";

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
    { value: "all" as const, label: "All Analytics", icon: Filter },
    { value: "folder" as const, label: "Folder", icon: FolderIcon },
    { value: "domain" as const, label: "Domain", icon: Globe },
    { value: "link" as const, label: "Link", icon: Link2 },
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
          className="h-10 w-full sm:w-[240px] justify-between gap-2 px-3"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm">{getFilterLabel()}</span>
          </div>
          {filterType !== "all" ? (
            <X
              className="h-4 w-4 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              onClick={clearFilter}
            />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          {viewMode === "items" && (
            <CommandInput
              placeholder={`Search ${selectedCategory}...`}
              className="h-11"
            />
          )}

          <CommandList className="max-h-[300px]">
            {viewMode === "categories" ? (
              <CommandGroup className="p-2">
                {categories.map((category) => {
                  const Icon = category.icon;
                  return (
                    <CommandItem
                      key={category.value}
                      value={category.value}
                      onSelect={() => handleCategorySelect(category.value)}
                      className="flex items-center justify-between px-3 py-2.5 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4" />
                        <span>{category.label}</span>
                      </div>
                      {category.value !== "all" && (
                        <ChevronRight className="h-4 w-4 opacity-50" />
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : (
              <>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : (
                  <>
                    <CommandEmpty className="py-8">No {selectedCategory} found.</CommandEmpty>
                    <CommandGroup className="p-2">
                      {getCurrentItems().map((item) => (
                        <CommandItem
                          key={item.value}
                          value={item.value}
                          onSelect={handleItemSelect}
                          className="px-3 py-2.5 cursor-pointer"
                        >
                          <div className="flex flex-col gap-0.5">
                            <span>{item.label}</span>
                            {item.subtitle && (
                              <span className="text-xs text-muted-foreground">
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
