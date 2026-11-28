"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { revalidateRoute } from "@/app/(main)/dashboard/revalidate-homepage";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { cn } from "@/lib/utils";
import { WEBHOOK_DESCRIPTION_MAX_LENGTH } from "@/lib/webhooks";
import { api } from "@/trpc/react";

import { WEBHOOK_EVENT_OPTIONS } from "./webhook-events";
import { WebhookSecret } from "./webhook-secret";

import type { WebhookEventType } from "@/lib/webhooks";
import type { RouterOutputs } from "@/trpc/shared";

type Endpoint = RouterOutputs["webhook"]["list"]["endpoints"][number];

type FormValues = { url: string; description: string; events: WebhookEventType[] };

const inputClassName =
  "h-9 border-neutral-200 bg-white text-[13px] placeholder:text-neutral-400 dark:border-border dark:bg-card max-sm:text-base";

/** Adds an endpoint (then shows its secret once) or edits `endpoint`. */
export function WebhookFormDialog({
  open,
  onOpenChange,
  endpoint,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  endpoint?: Endpoint;
}) {
  const [secret, setSecret] = useState<string | null>(null);
  const isEdit = !!endpoint;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    values: {
      url: endpoint?.url ?? "",
      description: endpoint?.description ?? "",
      events: endpoint?.events ?? WEBHOOK_EVENT_OPTIONS.map((option) => option.type),
    },
  });

  const createMutation = api.webhook.create.useMutation({
    onSuccess: async (created) => {
      setSecret(created.secret);
      await revalidateRoute("/dashboard/settings");
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = api.webhook.update.useMutation({
    onSuccess: async () => {
      toast.success("Webhook updated");
      onOpenChange(false);
      await revalidateRoute("/dashboard/settings");
    },
    onError: (error) => toast.error(error.message),
  });

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      // The secret only lives in this dialog; drop it once it closes.
      setSecret(null);
      reset();
    }
  };

  const onSubmit = (values: FormValues) => {
    if (endpoint) {
      updateMutation.mutate({ id: endpoint.id, ...values });
    } else {
      createMutation.mutate(values);
    }
  };

  const pending = createMutation.isLoading || updateMutation.isLoading;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        {secret ? (
          <>
            <DialogHeader>
              <DialogTitle>Your endpoint is ready</DialogTitle>
              <DialogDescription>
                Copy the signing secret and store it with your server&apos;s configuration.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <WebhookSecret secret={secret} />
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="h-9 bg-blue-600 text-[13px] hover:bg-blue-700"
              >
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{isEdit ? "Edit endpoint" : "Add endpoint"}</DialogTitle>
              <DialogDescription>
                We&apos;ll send a signed POST request to this URL for each event you pick
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)}>
              <DialogBody className="space-y-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="webhook-url"
                    className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300"
                  >
                    URL
                  </Label>
                  <Input
                    id="webhook-url"
                    type="url"
                    inputMode="url"
                    placeholder="https://example.com/webhooks/ishortn"
                    autoComplete="off"
                    spellCheck={false}
                    className={cn(
                      inputClassName,
                      errors.url && "border-red-300 focus-visible:ring-red-300",
                    )}
                    {...register("url", {
                      validate: (value) => {
                        const trimmed = value.trim();
                        if (!trimmed) return "URL is required";
                        return trimmed.startsWith("https://") || "URL must start with https://";
                      },
                    })}
                  />
                  {errors.url && <p className="text-[12px] text-red-500">{errors.url.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="webhook-description"
                    className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300"
                  >
                    Description{" "}
                    <span className="font-normal text-neutral-400 dark:text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="webhook-description"
                    placeholder="e.g. Zapier, CRM sync"
                    maxLength={WEBHOOK_DESCRIPTION_MAX_LENGTH}
                    autoComplete="off"
                    className={inputClassName}
                    {...register("description")}
                  />
                </div>

                <fieldset className="space-y-1.5">
                  <legend className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                    Events
                  </legend>
                  <Controller
                    control={control}
                    name="events"
                    rules={{ validate: (value) => value.length > 0 || "Choose at least one event" }}
                    render={({ field }) => (
                      <div className="divide-y divide-neutral-300/60 rounded-lg border border-neutral-200 dark:divide-border dark:border-border">
                        {WEBHOOK_EVENT_OPTIONS.map((option) => {
                          const id = `webhook-event-${option.type}`;
                          const checked = field.value.includes(option.type);
                          return (
                            <label
                              key={option.type}
                              htmlFor={id}
                              className="flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors hover:bg-neutral-50 dark:hover:bg-accent/50"
                            >
                              <Checkbox
                                id={id}
                                checked={checked}
                                onCheckedChange={(next) =>
                                  field.onChange(
                                    next
                                      ? [...field.value, option.type]
                                      : field.value.filter((type) => type !== option.type),
                                  )
                                }
                                className="mt-0.5"
                              />
                              <span className="min-w-0">
                                <span className="block text-[13px] font-medium text-neutral-900 dark:text-foreground">
                                  {option.label}
                                </span>
                                <span className="block text-[12px] text-neutral-400 dark:text-muted-foreground">
                                  <code className="font-mono">{option.type}</code> &middot;{" "}
                                  {option.hint}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  />
                  {errors.events && (
                    <p className="text-[12px] text-red-500">{errors.events.message}</p>
                  )}
                </fieldset>
              </DialogBody>

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleOpenChange(false)}
                  className="h-9 text-[13px]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={pending}
                  className="h-9 bg-blue-600 text-[13px] hover:bg-blue-700"
                >
                  {isEdit
                    ? pending
                      ? "Saving..."
                      : "Save"
                    : pending
                      ? "Adding..."
                      : "Add endpoint"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
