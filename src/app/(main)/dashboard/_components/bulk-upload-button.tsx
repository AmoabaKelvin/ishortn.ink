import { motion } from "framer-motion";
import { CloudUploadIcon } from "lucide-react";
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
import Link from "next/link";

type BulkLinkUploadDialogProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  proMembership: boolean;
};

export function BulkLinkUploadDialog({ open, setOpen, proMembership }: BulkLinkUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "text/csv": [".csv"],
    },
    maxFiles: 1,
    multiple: false,
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0];
      setFile(file as File);
    },
    onDropRejected: () => {
      toast.error("Unsupported file type. Please upload a CSV file.");
    },
  });

  const uploadMutation = api.link.bulkUpload.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      setOpen(false);
      setFile(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleUpload = async () => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const csv = e.target?.result as string;
      await uploadMutation.mutateAsync({ csv });
    };
    reader.readAsText(file);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            <label
              htmlFor="dropzone-file"
              className={cn(
                "flex h-64 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 transition-all duration-300 hover:bg-gray-100",
                {
                  "border-gray-500": isDragActive,
                },
              )}
            >
              <div className="flex flex-col items-center justify-center pb-6 pt-5">
                <motion.div
                  animate={{ y: isDragActive ? -10 : 0 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <CloudUploadIcon className="mb-4 h-8 w-8 text-gray-500" />
                </motion.div>
                <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                  {isDragActive
                    ? "Drop the files here to upload"
                    : file
                      ? "Successfully uploaded " + file.name
                      : "Drag 'n' drop some files here, or click to select files"}
                </p>
              </div>
            </label>
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
            <Link href="/dashboard/settings/billing">Upgrade to Pro 🚀</Link>
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
