"use client";

import { Pencil } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-blue-600" />
            Edit Folder
          </DialogTitle>
          <DialogDescription>
            Update your folder's name and description.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">
                Folder Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-name"
                placeholder="e.g., Marketing Campaign 2024"
                className={errors.name ? "border-red-500" : ""}
                {...register("name", {
                  required: "Folder name is required",
                  maxLength: {
                    value: 255,
                    message: "Folder name is too long",
                  },
                })}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description (Optional)</Label>
              <Textarea
                id="edit-description"
                placeholder="Add notes about what this folder contains..."
                rows={3}
                className="resize-none"
                {...register("description")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateFolderMutation.isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {updateFolderMutation.isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
