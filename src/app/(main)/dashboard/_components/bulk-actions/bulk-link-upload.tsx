import { IconFileSpreadsheet, IconUpload } from "@tabler/icons-react";
import { Link } from "next-view-transitions";
import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

import { revalidateHomepage } from "@/app/(main)/dashboard/revalidate-homepage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import type { RouterOutputs } from "@/trpc/shared";

type ImportFailure = RouterOutputs["link"]["bulkUpload"]["failures"][number];

type BulkLinkUploadDialogProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  proMembership: boolean;
};

export function BulkLinkUploadDialog({ open, setOpen, proMembership }: BulkLinkUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [failures, setFailures] = useState<ImportFailure[]>([]);

  const utils = api.useUtils();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "text/csv": [".csv"],
    },
    maxFiles: 1,
    multiple: false,
    onDrop: (acceptedFiles) => {
      setFile(acceptedFiles[0] ?? null);
      setFailures([]);
    },
    onDropRejected: () => {
      toast.error("Unsupported file type. Please upload a CSV file.");
    },
  });

  const uploadMutation = api.link.bulkUpload.useMutation({
    onSuccess: async (result) => {
      setFile(null);
      if (result.created > 0) {
        await utils.link.list.invalidate();
        await revalidateHomepage();
      }
      if (result.failed === 0) {
        toast.success(result.message);
        setOpen(false);
        return;
      }
      // Keep the dialog open so the per-row reasons stay readable.
      if (result.created > 0) toast.success(result.message);
      else toast.error(result.message);
      setFailures(result.failures);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleUpload = async () => {
    if (!file) return;

    const csv = await file.text();
    uploadMutation.mutate({ csv });
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setFile(null);
      setFailures([]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Import links from CSV</DialogTitle>
          <DialogDescription>
            {proMembership
              ? "Include a url column. alias, domain and note are optional. Up to 1,000 links per file."
              : "Importing links from a CSV file is available on paid plans."}
          </DialogDescription>
        </DialogHeader>

        {proMembership && (
          <DialogBody className="space-y-4">
            <div
              {...getRootProps({ role: "button", "aria-label": "Choose a CSV file to import" })}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-10 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
                isDragActive
                  ? "border-blue-600 bg-blue-50 dark:bg-blue-500/10"
                  : "border-neutral-300 bg-neutral-50 hover:bg-neutral-100 dark:border-border dark:bg-accent/50 dark:hover:bg-accent",
              )}
            >
              <input {...getInputProps()} />
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-card">
                {file ? (
                  <IconFileSpreadsheet
                    size={18}
                    stroke={1.5}
                    className="text-neutral-500 dark:text-neutral-400"
                  />
                ) : (
                  <IconUpload
                    size={18}
                    stroke={1.5}
                    className="text-neutral-400 dark:text-neutral-500"
                  />
                )}
              </div>
              {file ? (
                <>
                  <p className="mt-3 max-w-full truncate text-[13px] font-medium text-neutral-900 dark:text-foreground">
                    {file.name}
                  </p>
                  <p className="mt-1 text-[12px] text-neutral-400 dark:text-neutral-500">
                    Ready to import. Click to choose a different file.
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-3 text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                    {isDragActive ? "Drop the file to select it" : "Drop a CSV file here"}
                  </p>
                  <p className="mt-1 text-[12px] text-neutral-400 dark:text-neutral-500">
                    or click to choose one
                  </p>
                </>
              )}
            </div>

            {failures.length > 0 && (
              <div className="rounded-lg border border-neutral-200 dark:border-border">
                <p className="border-b border-neutral-100 px-3 py-2 text-[13px] font-medium text-neutral-900 dark:border-border/50 dark:text-foreground">
                  {failures.length.toLocaleString()}{" "}
                  {failures.length === 1 ? "row was" : "rows were"} not imported
                </p>
                <ul className="max-h-48 divide-y divide-neutral-300/60 overflow-y-auto dark:divide-border">
                  {failures.map((failure) => (
                    <li key={failure.row} className="flex gap-2 px-3 py-2 text-[12px]">
                      <span className="shrink-0 tabular-nums text-neutral-400 dark:text-neutral-500">
                        Row {failure.row.toLocaleString()}
                      </span>
                      <span className="min-w-0 break-words text-red-600 dark:text-red-400">
                        {failure.reason}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </DialogBody>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            className="h-9 text-[13px]"
          >
            {failures.length > 0 ? "Close" : "Cancel"}
          </Button>
          {proMembership ? (
            <Button
              type="button"
              onClick={handleUpload}
              disabled={!file || uploadMutation.isLoading}
              className="h-9 bg-blue-600 text-[13px] hover:bg-blue-700"
            >
              {uploadMutation.isLoading ? "Importing..." : "Import links"}
            </Button>
          ) : (
            <Button asChild className="h-9 bg-blue-600 text-[13px] hover:bg-blue-700">
              <Link href="/dashboard/settings#billing">Upgrade</Link>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
