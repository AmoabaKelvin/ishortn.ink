"use client";

import { FolderPlus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";
import { revalidateRoute } from "@/app/(main)/dashboard/revalidate-homepage";

import type { CreateFolderInput } from "@/server/api/routers/folder/folder.input";

type CreateFolderModalProps = {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function CreateFolderModal({ trigger, open: controlledOpen, onOpenChange }: CreateFolderModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateFolderInput>();

  const utils = api.useUtils();

  const createFolderMutation = api.folder.create.useMutation({
    onSuccess: async () => {
      toast.success("Folder created successfully");
      trackEvent(POSTHOG_EVENTS.FOLDER_CREATED);
      await utils.folder.list.invalidate();
      await revalidateRoute("/dashboard/folders");
      reset();
      setOpen(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (data: CreateFolderInput) => {
    createFolderMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-blue-600" />
            Create New Folder
          </DialogTitle>
          <DialogDescription>
            Organize your links by creating a new folder. Give it a name and optional description.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Folder Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
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
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
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
              onClick={() => {
                reset();
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createFolderMutation.isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {createFolderMutation.isLoading ? "Creating..." : "Create Folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

