import { IconFileSpreadsheet, IconUpload } from "@tabler/icons-react";
import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

import { revalidateHomepage } from "@/app/(main)/dashboard/revalidate-homepage";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UpgradeCta } from "@/components/upgrade-cta";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import type { RouterOutputs } from "@/trpc/shared";

type ImportResult = RouterOutputs["link"]["bulkUpload"];

type BulkLinkUploadDialogProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  proMembership: boolean;
};

export function BulkLinkUploadDialog({ open, setOpen, proMembership }: BulkLinkUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [keepBitlyCodes, setKeepBitlyCodes] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);

  const utils = api.useUtils();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "text/csv": [".csv"],
    },
    maxFiles: 1,
    multiple: false,
    onDrop: (acceptedFiles) => {
      setFile(acceptedFiles[0] ?? null);
      setResult(null);
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
      if (result.failed === 0 && result.notices.length === 0) {
        toast.success(result.message);
        setOpen(false);
        return;
      }
      // Keep the dialog open so the per-row reasons and notices stay readable.
      if (result.created > 0 || result.alreadyImported > 0) toast.success(result.message);
      else toast.error(result.message);
      setResult(result);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleUpload = async () => {
    if (!file) return;

    const csv = await file.text();
    uploadMutation.mutate({ csv, keepBitlyCodes });
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setFile(null);
      setResult(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Import links from CSV</DialogTitle>
          <DialogDescription>
            {proMembership
              ? "Upload a CSV with a url column (alias, domain and note optional), or a link export from Bitly as-is. Up to 1,000 links per file."
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
                    className="text-neutral-400 dark:text-muted-foreground"
                  />
                )}
              </div>
              {file ? (
                <>
                  <p className="mt-3 max-w-full truncate text-[13px] font-medium text-neutral-900 dark:text-foreground">
                    {file.name}
                  </p>
                  <p className="mt-1 text-[12px] text-neutral-400 dark:text-muted-foreground">
                    Ready to import. Click to choose a different file.
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-3 text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                    {isDragActive ? "Drop the file to select it" : "Drop a CSV file here"}
                  </p>
                  <p className="mt-1 text-[12px] text-neutral-400 dark:text-muted-foreground">
                    or click to choose one
                  </p>
                </>
              )}
            </div>

            <label
              htmlFor="keep-bitly-codes"
              className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-neutral-200 p-3 dark:border-border"
            >
              <Checkbox
                id="keep-bitly-codes"
                checked={keepBitlyCodes}
                onCheckedChange={(value) => setKeepBitlyCodes(value === true)}
                className="mt-0.5"
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                  Also keep Bitly&apos;s original codes (like go.example.com/3XCetqn) working
                </span>
                <span className="mt-0.5 block text-[12px] text-neutral-400 dark:text-muted-foreground">
                  Applies to Bitly exports. Each code counts as one link.
                </span>
              </span>
            </label>

            {result && (
              <div className="space-y-3">
                <p className="text-[13px] text-neutral-700 dark:text-neutral-300">
                  {result.message}
                </p>

                {result.domainNotices.length > 0 && (
                  <ul className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-700 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
                    {result.domainNotices.map((notice) => (
                      <li key={notice} className="break-words">
                        {notice}
                      </li>
                    ))}
                  </ul>
                )}

                {result.failures.length > 0 && (
                  <ImportRowList
                    title={`${result.failures.length.toLocaleString()} ${result.failures.length === 1 ? "row was" : "rows were"} not imported`}
                    items={result.failures.map((failure) => ({
                      row: failure.row,
                      text: failure.reason,
                    }))}
                    textClassName="text-red-600 dark:text-red-400"
                  />
                )}

                {result.notices.length > 0 && (
                  <ImportRowList
                    title={`${result.notices.length.toLocaleString()} ${result.notices.length === 1 ? "row" : "rows"} imported with changes`}
                    items={result.notices.map((notice) => ({
                      row: notice.row,
                      text: notice.message,
                    }))}
                    textClassName="text-neutral-700 dark:text-neutral-300"
                  />
                )}
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
            {result ? "Close" : "Cancel"}
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
              <UpgradeCta requiredPlan="pro" source="bulk_import">
                Upgrade
              </UpgradeCta>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ImportRowListProps = {
  title: string;
  items: { row: number; text: string }[];
  textClassName: string;
};

function ImportRowList({ title, items, textClassName }: ImportRowListProps) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-border">
      <p className="border-b border-neutral-100 px-3 py-2 text-[13px] font-medium text-neutral-900 dark:border-border/50 dark:text-foreground">
        {title}
      </p>
      <ul className="max-h-48 divide-y divide-neutral-300/60 overflow-y-auto dark:divide-border">
        {items.map((item, index) => (
          <li key={`${item.row}-${index}`} className="flex gap-2 px-3 py-2 text-[12px]">
            <span className="shrink-0 tabular-nums text-neutral-400 dark:text-muted-foreground">
              Row {item.row.toLocaleString()}
            </span>
            <span className={cn("min-w-0 break-words", textClassName)}>{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
