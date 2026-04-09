"use client";

import {
  IconDots,
  IconFileSpreadsheet,
  IconJson,
  IconUpload,
} from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { convertDataToCSV } from "@/lib/utils/convert-links-to-csv";
import { convertDataToJSON } from "@/lib/utils/convert-links-to-json";
import { api } from "@/trpc/react";

import { BulkLinkUploadDialog } from "./bulk-link-upload";

export function BulkLinkActions() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const { data: subStatus } = api.subscriptions.get.useQuery();

  const { mutate: exportLinks, isLoading } =
    api.link.exportUserLinks.useMutation({
      onSuccess: (_data) => {},
      onError: (error) => {
        toast.error(error.message);
      },
    });

  const triggerDownload = (content: string, fileName: string): void => {
    const encodedUri = encodeURI(content);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = (format: "csv" | "json") => {
    const exportPromise = new Promise((resolve, reject) => {
      exportLinks(undefined, {
        onSuccess: (data) => {
          const content =
            format === "csv"
              ? convertDataToCSV(data)
              : convertDataToJSON(data);
          const fileName = `ishortn_links.${format}`;
          triggerDownload(content, fileName);
          trackEvent(POSTHOG_EVENTS.LINKS_EXPORTED, {
            format,
            link_count: data.length,
          });
          resolve(undefined);
        },
        onError: (error) => reject(error),
      });
    });

    toast.promise(exportPromise, {
      loading: "Exporting links...",
      success: "Links exported",
      error: "Failed to export links",
    });
  };

  return (
    <>
      <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <button
            disabled={isLoading}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 dark:border-border bg-white dark:bg-card text-neutral-500 dark:text-neutral-400 transition-colors hover:bg-neutral-50 dark:hover:bg-accent/50 hover:text-neutral-700 dark:hover:text-neutral-300 disabled:opacity-50"
          >
            <IconDots size={16} stroke={1.5} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-44 border-neutral-200 dark:border-border p-1"
          sideOffset={4}
        >
          <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
            Import
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => setIsUploadModalOpen(true)}
            className="rounded-md px-2 py-1.5 text-[13px] text-neutral-600 dark:text-neutral-400 focus:bg-neutral-50 dark:focus:bg-accent/50 focus:text-neutral-900 dark:focus:text-foreground"
          >
            <IconUpload
              size={15}
              stroke={1.5}
              className="mr-2 text-neutral-400"
            />
            Upload CSV
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1 bg-neutral-100 dark:bg-border" />

          <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
            Export
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => handleExport("csv")}
            disabled={isLoading}
            className="rounded-md px-2 py-1.5 text-[13px] text-neutral-600 dark:text-neutral-400 focus:bg-neutral-50 dark:focus:bg-accent/50 focus:text-neutral-900 dark:focus:text-foreground"
          >
            <IconFileSpreadsheet
              size={15}
              stroke={1.5}
              className="mr-2 text-neutral-400"
            />
            Export as CSV
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleExport("json")}
            disabled={isLoading}
            className="rounded-md px-2 py-1.5 text-[13px] text-neutral-600 dark:text-neutral-400 focus:bg-neutral-50 dark:focus:bg-accent/50 focus:text-neutral-900 dark:focus:text-foreground"
          >
            <IconJson
              size={15}
              stroke={1.5}
              className="mr-2 text-neutral-400"
            />
            Export as JSON
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <BulkLinkUploadDialog
        open={isUploadModalOpen && !isDropdownOpen}
        setOpen={setIsUploadModalOpen}
        proMembership={subStatus?.subscriptions?.status === "active"}
      />
    </>
  );
}
