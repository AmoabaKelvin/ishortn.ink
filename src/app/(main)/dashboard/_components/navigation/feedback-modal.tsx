"use client";

import { IconPhoto, IconUpload, IconX } from "@tabler/icons-react";
import { Loader2 } from "lucide-react";
import type React from "react";
import { useCallback, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

const FEEDBACK_TYPES = [
  { value: "bug", label: "Bug Report" },
  { value: "feature", label: "Feature Request" },
  { value: "question", label: "General Question" },
] as const;

type FeedbackFormData = {
  type: (typeof FEEDBACK_TYPES)[number]["value"];
  message: string;
};

type FeedbackModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const MAX_IMAGES = 3;
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export function FeedbackModal({ open, onOpenChange }: FeedbackModalProps) {
  const [images, setImages] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FeedbackFormData>();

  const feedbackMutation = api.feedback.create.useMutation({
    onSuccess: () => {
      toast.success("Thanks for your feedback!");
      reset();
      setImages([]);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send feedback");
    },
  });

  const processFiles = useCallback(
    (files: FileList | File[]) => {
      const remaining = MAX_IMAGES - images.length;
      const filesToProcess = Array.from(files).slice(0, remaining);

      for (const file of filesToProcess) {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`${file.name} exceeds 2MB limit`);
          continue;
        }
        if (!ACCEPTED_TYPES.includes(file.type)) {
          toast.error(`${file.name} is not a supported image format`);
          continue;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          setImages((prev) => {
            if (prev.length >= MAX_IMAGES) return prev;
            return [...prev, reader.result as string];
          });
        };
        reader.readAsDataURL(file);
      }
    },
    [images.length],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = (data: FeedbackFormData) => {
    feedbackMutation.mutate({
      type: data.type,
      message: data.message,
      images: images.length > 0 ? images : undefined,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          reset();
          setImages([]);
        }
        onOpenChange(value);
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
          <DialogDescription>
            Report a bug, request a feature, or ask a question.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody className="space-y-5">
            {/* Type selector */}
            <div className="space-y-2">
              <Label
                htmlFor="type"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Type
              </Label>
              <Controller
                name="type"
                control={control}
                rules={{ required: "Please select a feedback type" }}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger
                      className={cn(
                        "h-10",
                        errors.type && "border-destructive",
                      )}
                    >
                      <SelectValue placeholder="What is this about?" />
                    </SelectTrigger>
                    <SelectContent>
                      {FEEDBACK_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.type && (
                <p className="text-xs text-destructive">
                  {errors.type.message}
                </p>
              )}
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label
                htmlFor="message"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Message
              </Label>
              <Textarea
                id="message"
                placeholder="Describe what you need help with..."
                rows={4}
                className="resize-none text-sm"
                {...register("message", {
                  required: "Please enter a message",
                  maxLength: {
                    value: 2000,
                    message: "Message is too long (max 2000 characters)",
                  },
                })}
              />
              {errors.message && (
                <p className="text-xs text-destructive">
                  {errors.message.message}
                </p>
              )}
            </div>

            {/* Image upload */}
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Screenshots
                <span className="ml-1.5 lowercase tracking-normal font-normal text-muted-foreground/60">
                  optional
                </span>
              </Label>

              {/* Thumbnails */}
              {images.length > 0 && (
                <div className="flex gap-2">
                  {images.map((img, i) => (
                    <div
                      key={i}
                      className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-neutral-200 dark:border-border"
                    >
                      <img
                        src={img}
                        alt={`Upload ${i + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40"
                      >
                        <IconX
                          size={14}
                          stroke={2}
                          className="text-white opacity-0 transition-opacity group-hover:opacity-100"
                        />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Drop zone */}
              {images.length < MAX_IMAGES && (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-4 transition-colors",
                    isDragging
                      ? "border-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                      : "border-neutral-300 dark:border-neutral-600 bg-neutral-50/50 dark:bg-accent/30 hover:border-neutral-400 dark:hover:border-neutral-500 hover:bg-neutral-50 dark:hover:bg-accent/50",
                  )}
                >
                  {isDragging ? (
                    <IconPhoto
                      size={20}
                      stroke={1.5}
                      className="text-blue-400"
                    />
                  ) : (
                    <IconUpload
                      size={20}
                      stroke={1.5}
                      className="text-neutral-400 dark:text-neutral-500"
                    />
                  )}
                  <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
                    {isDragging ? (
                      "Drop here"
                    ) : (
                      <>
                        Drop images or{" "}
                        <span className="font-medium text-neutral-700 dark:text-neutral-300">
                          browse
                        </span>
                      </>
                    )}
                  </p>
                  <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                    PNG, JPG, GIF, WebP up to 2MB ({MAX_IMAGES - images.length}{" "}
                    remaining)
                  </p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                multiple
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={(e) => {
                  if (e.target.files) processFiles(e.target.files);
                  e.target.value = "";
                }}
                aria-label="Upload screenshots"
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                reset();
                setImages([]);
                onOpenChange(false);
              }}
              disabled={feedbackMutation.isLoading}
              className="h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={feedbackMutation.isLoading}
              className="h-9"
            >
              {feedbackMutation.isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Feedback"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
