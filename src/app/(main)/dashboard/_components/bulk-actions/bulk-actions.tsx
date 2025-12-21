"use client";

import { FileJson, FileSpreadsheet, MoreHorizontal, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { Button } from "@/components/ui/button";
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
      onSuccess: (data) => {
        // Format will be set by the specific handler
      },
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
            format === "csv" ? convertDataToCSV(data) : convertDataToJSON(data);
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
          <Button
            size="icon"
            variant="outline"
            disabled={isLoading}
            className="rounded-xl border-gray-200 hover:bg-gray-100 hover:border-gray-300"
          >
            <MoreHorizontal className="h-4 w-4 text-gray-500" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-48 rounded-xl border-gray-200 p-1.5 shadow-lg"
          sideOffset={8}
        >
          {/* Import */}
          <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium text-gray-400">
            Import
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => setIsUploadModalOpen(true)}
            className="rounded-lg px-2 py-2 text-sm font-medium text-gray-700 focus:bg-gray-100"
          >
            <Upload className="mr-2.5 h-4 w-4 text-gray-400" />
            Upload CSV
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1.5 bg-gray-100" />

          {/* Export */}
          <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium text-gray-400">
            Export
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => handleExport("csv")}
            disabled={isLoading}
            className="rounded-lg px-2 py-2 text-sm font-medium text-gray-700 focus:bg-gray-100"
          >
            <FileSpreadsheet className="mr-2.5 h-4 w-4 text-gray-400" />
            Export as CSV
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleExport("json")}
            disabled={isLoading}
            className="rounded-lg px-2 py-2 text-sm font-medium text-gray-700 focus:bg-gray-100"
          >
            <FileJson className="mr-2.5 h-4 w-4 text-gray-400" />
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
