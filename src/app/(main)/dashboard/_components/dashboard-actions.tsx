"use client";

import { EllipsisVertical, FileDown, UploadIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { convertDataToCSV } from "@/lib/utils/convert-links-to-csv";
import { convertDataToJSON } from "@/lib/utils/convert-links-to-json";
import { api } from "@/trpc/react";

import { BulkLinkUploadDialog } from "./bulk-upload-button";

export function DashboardActions() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [format, setFormat] = useState<"csv" | "json">("csv");

  const { data: subStatus } = api.subscriptions.get.useQuery();

  const { mutate: exportLinks, isLoading } = api.link.exportUserLinks.useMutation({
    onSuccess: (data) => {
      const content = format === "csv" ? convertDataToCSV(data) : convertDataToJSON(data);
      const fileName = `ishortn_links.${format}`;
      triggerDownload(content, fileName);
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
    setFormat(format);

    const exportPromise = new Promise((resolve, reject) => {
      exportLinks(undefined, {
        onSuccess: () => resolve(undefined),
        onError: (error) => reject(error),
      });
    });

    toast.promise(exportPromise, {
      loading: "Exporting links...",
      success: "Links exported successfully",
      error: "Failed to export links",
    });
  };

  return (
    <>
      <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger>
          <Button size="icon" variant="outline" disabled={isLoading}>
            <EllipsisVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="space-y-2">
          <DropdownMenuItem onClick={() => setIsUploadModalOpen(true)}>
            <div className="flex items-center gap-2">
              <UploadIcon className="h-4 w-4" />
              <span>Upload CSV</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={isLoading}>
              <FileDown className="mr-2 h-4 w-4" />
              <span>Export as</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => handleExport("csv")} disabled={isLoading}>
                  <span>CSV</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("json")} disabled={isLoading}>
                  <span>JSON</span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
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
