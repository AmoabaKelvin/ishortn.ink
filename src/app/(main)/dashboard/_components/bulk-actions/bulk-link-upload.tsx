import { motion } from "framer-motion";
import { CloudUploadIcon } from "lucide-react";
import { Link } from "next-view-transitions";
import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { satoshi } from "@/styles/fonts";
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
    onSuccess: (result) => {
      setFile(null);
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
    await uploadMutation.mutateAsync({ csv });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setFailures([]);
      }}
    >
      <DialogContent className={`sm:max-w-[425px] ${satoshi.className}`}>
        <DialogHeader>
          <DialogTitle>Bulk Link Upload</DialogTitle>
          {proMembership && (
            <DialogDescription>
              Upload a CSV file with your links. The CSV should have our required columns: 'url',
              'alias' (optional), 'domain' (optional), 'note' (optional). (optional).
            </DialogDescription>
          )}
        </DialogHeader>
        {proMembership && (
          <div className="flex w-full items-center justify-center" {...getRootProps()}>
            <input {...getInputProps()} />
            <div
              className={cn(
                "flex h-64 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 dark:border-border bg-gray-50 dark:bg-accent/50 transition-all duration-300 hover:bg-gray-100 dark:hover:bg-accent",
                {
                  "border-gray-500 dark:border-neutral-400": isDragActive,
                },
              )}
            >
              <div className="flex flex-col items-center justify-center pb-6 pt-5">
                <motion.div
                  animate={{ y: isDragActive ? -10 : 0 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <CloudUploadIcon className="mb-4 h-8 w-8 text-gray-500 dark:text-neutral-400" />
                </motion.div>
                <p className="mb-2 text-sm text-gray-500 dark:text-neutral-400">
                  {isDragActive
                    ? "Drop the files here to upload"
                    : file
                      ? `Successfully uploaded ${file.name}`
                      : "Drag 'n' drop some files here, or click to select files"}
                </p>
              </div>
            </div>
          </div>
        )}

        {failures.length > 0 && (
          <div className="rounded-lg border border-neutral-200 dark:border-border">
            <p className="border-b border-neutral-100 px-3 py-2 text-[13px] font-medium text-neutral-900 dark:border-border/50 dark:text-foreground">
              {failures.length.toLocaleString()} {failures.length === 1 ? "row was" : "rows were"}{" "}
              not imported
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

        {!proMembership && (
          <div className="flex w-full items-center justify-center">
            <p>You need to be a pro member to use this feature.</p>
          </div>
        )}

        {proMembership ? (
          <Button onClick={handleUpload} disabled={!file || uploadMutation.isLoading}>
            {uploadMutation.isLoading ? "Creating links ..." : "Create links"}
          </Button>
        ) : (
          <Button asChild>
            <Link href="/dashboard/settings#billing">Upgrade to Pro 🚀</Link>
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
