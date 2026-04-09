"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { revalidateRoute } from "@/app/(main)/dashboard/revalidate-homepage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
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
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import type { CreateFolderInput } from "@/server/api/routers/folder/folder.input";

type CreateFolderModalProps = {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function CreateFolderModal({
  trigger,
  open: controlledOpen,
  onOpenChange,
}: CreateFolderModalProps) {
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
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Create Folder</DialogTitle>
          <DialogDescription>
            Organize your links into a new folder
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="name"
                className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300"
              >
                Name
              </Label>
              <Input
                id="name"
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
                htmlFor="description"
                className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300"
              >
                Description
                <span className="ml-1.5 text-[12px] font-normal text-neutral-400 dark:text-neutral-500">
                  optional
                </span>
              </Label>
              <Textarea
                id="description"
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
              onClick={() => {
                reset();
                setOpen(false);
              }}
              className="h-9 text-[13px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createFolderMutation.isLoading}
              className="h-9 bg-blue-600 text-[13px] hover:bg-blue-700"
            >
              {createFolderMutation.isLoading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
