"use client";

import { MoreVertical, Pencil, Trash2 } from "lucide-react";
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
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/trpc/react";

import type { UtmTemplate } from "@/server/db/schema";

type UtmTemplateCardProps = {
  template: UtmTemplate;
  onEdit: (template: UtmTemplate) => void;
};

export function UtmTemplateCard({ template, onEdit }: UtmTemplateCardProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const utils = api.useUtils();

  const deleteMutation = api.utmTemplate.delete.useMutation({
    onSuccess: () => {
      setDeleteDialogOpen(false);
      toast.success("Template deleted successfully");
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
      <Card className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 truncate">
              {template.name}
            </h3>
            <div className="mt-2 space-y-1">
              {utmParams.length > 0 ? (
                utmParams.map((param) => (
                  <div
                    key={param.label}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="text-gray-500 w-20 shrink-0">
                      {param.label}:
                    </span>
                    <span className="text-gray-700 truncate">{param.value}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No parameters set</p>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="p-1 hover:bg-gray-100 rounded"
              aria-label={`Open options for ${template.name}`}
            >
              <MoreVertical className="h-4 w-4 text-gray-500" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(template)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{template.name}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate({ id: template.id })}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
