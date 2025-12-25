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
            <div className="space-y-2">
              <Label
                htmlFor="name"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Name
              </Label>
              <Input
                id="name"
                placeholder="Folder name"
                className={cn(
                  "h-10",
                  errors.name &&
                    "border-destructive focus-visible:ring-destructive"
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
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="description"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Description
                <span className="ml-1.5 text-muted-foreground/60 lowercase tracking-normal font-normal">
                  optional
                </span>
              </Label>
              <Textarea
                id="description"
                placeholder="Add notes about this folder..."
                rows={3}
                className="resize-none text-sm"
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
              className="h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createFolderMutation.isLoading}
              className="h-9"
            >
              {createFolderMutation.isLoading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

