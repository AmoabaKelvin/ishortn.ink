"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import type { UpdateFolderInput } from "@/server/api/routers/folder/folder.input";
import type { RouterOutputs } from "@/trpc/shared";

type EditFolderModalProps = {
  folder:
    | (RouterOutputs["folder"]["list"][number] | RouterOutputs["folder"]["get"])
    | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditFolderModal({
  folder,
  open,
  onOpenChange,
}: EditFolderModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateFolderInput>();

  const utils = api.useUtils();

  const updateFolderMutation = api.folder.update.useMutation({
    onSuccess: async () => {
      toast.success("Folder updated successfully");
      await utils.folder.list.invalidate();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    if (folder && open) {
      reset({
        id: folder.id,
        name: folder.name,
        description: folder.description || "",
      });
    }
  }, [folder, open, reset]);

  const onSubmit = (data: UpdateFolderInput) => {
    if (!folder) return;
    updateFolderMutation.mutate({
      ...data,
      id: folder.id,
    });
  };

  if (!folder) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Edit Folder</DialogTitle>
          <DialogDescription>Update folder details</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="edit-name"
                className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300"
              >
                Name
              </Label>
              <Input
                id="edit-name"
                placeholder="Folder name"
                className={cn(
                  "h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400",
                  errors.name &&
                    "border-red-300 focus-visible:ring-red-300"
                )}
                {...register("name", {
                  required: "Folder name is required",
                  maxLength: {
                    value: 255,
                    message: "Folder name is too long",
                  },
                })}
              />
              {errors.name && (
                <p className="text-[12px] text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="edit-description"
                className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300"
              >
                Description
                <span className="ml-1.5 text-[12px] font-normal text-neutral-400 dark:text-neutral-500">
                  optional
                </span>
              </Label>
              <Textarea
                id="edit-description"
                placeholder="Add notes about this folder..."
                rows={3}
                className="resize-none border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400"
                {...register("description")}
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-9 text-[13px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateFolderMutation.isLoading}
              className="h-9 bg-blue-600 text-[13px] hover:bg-blue-700"
            >
              {updateFolderMutation.isLoading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
