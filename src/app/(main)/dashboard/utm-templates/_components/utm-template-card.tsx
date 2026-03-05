"use client";

import { motion } from "framer-motion";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api } from "@/trpc/react";

import type { UtmTemplate } from "@/server/db/schema";

type UtmTemplateCardProps = {
  template: UtmTemplate;
  index: number;
  onEdit: (template: UtmTemplate) => void;
};

export function UtmTemplateCard({
  template,
  index,
  onEdit,
}: UtmTemplateCardProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const utils = api.useUtils();

  const deleteMutation = api.utmTemplate.delete.useMutation({
    onSuccess: () => {
      setDeleteDialogOpen(false);
      toast.success("Template deleted");
      utils.utmTemplate.list.invalidate();
    },
    onError: (error) => {
      setDeleteDialogOpen(false);
      toast.error(error.message);
    },
  });

  const utmParams = [
    { label: "Source", value: template.utmSource },
    { label: "Medium", value: template.utmMedium },
    { label: "Campaign", value: template.utmCampaign },
    { label: "Term", value: template.utmTerm },
    { label: "Content", value: template.utmContent },
  ].filter((param) => param.value);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.2, delay: index * 0.04 }}
      >
        <div className="group px-1 py-4">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <span className="truncate text-[14px] font-medium text-neutral-900">
                {template.name}
              </span>
              <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px]">
                {utmParams.length > 0 ? (
                  utmParams.map((param, i) => (
                    <span
                      key={param.label}
                      className="inline-flex items-center gap-x-1.5"
                    >
                      {i > 0 && (
                        <span className="text-neutral-300">&middot;</span>
                      )}
                      <span className="text-neutral-400">{param.label}:</span>
                      <span className="text-neutral-500">{param.value}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-neutral-400">No parameters set</span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() => onEdit(template)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
              >
                <IconPencil size={14} stroke={1.5} />
              </button>
              <button
                type="button"
                onClick={() => setDeleteDialogOpen(true)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <IconTrash size={14} stroke={1.5} />
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[14px]">
              Delete template
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[12px]">
              Are you sure you want to delete &quot;{template.name}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-9 text-[13px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate({ id: template.id })}
              className="h-9 bg-red-600 text-[13px] hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
