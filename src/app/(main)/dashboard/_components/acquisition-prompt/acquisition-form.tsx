"use client";

import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { ACQUISITION_CHANNEL_OPTIONS, USE_CASE_OPTIONS } from "@/lib/audience-feedback/options";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import type { Plan } from "@/lib/billing/plans";
import type { SubmitAcquisitionInput } from "@/server/api/routers/audience-feedback/audience-feedback.input";

export type AcquisitionPromptSource = "checkout" | "dashboard";

type AcquisitionFormProps = {
  source: AcquisitionPromptSource;
  plan: Plan;
  variant: "card" | "dialog";
  // Called once the prompt should close: after a successful submit or "Not now".
  onDone: () => void;
};

/** Records "Not now" (also used when the checkout dialog is closed without answering). */
export function useDismissAcquisition(source: AcquisitionPromptSource, plan: Plan) {
  const dismissMutation = api.audienceFeedback.dismissAcquisition.useMutation();
  return () => {
    trackEvent(POSTHOG_EVENTS.ACQUISITION_PROMPT_DISMISSED, { source, plan });
    dismissMutation.mutate();
  };
}

const FIELD_CLASS = "h-9 border-neutral-200 bg-white text-[13px] dark:border-border dark:bg-card";
const LABEL_CLASS = "text-[13px] font-medium text-neutral-700 dark:text-neutral-300";

export function AcquisitionForm({ source, plan, variant, onDone }: AcquisitionFormProps) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SubmitAcquisitionInput>();
  const fieldId = (name: string) => `acquisition-${source}-${name}`;

  const submitMutation = api.audienceFeedback.submitAcquisition.useMutation({
    onSuccess: (_, input) => {
      trackEvent(POSTHOG_EVENTS.ACQUISITION_PROMPT_SUBMITTED, {
        source,
        plan,
        channel: input.acquisitionChannel,
        use_case: input.useCase ?? null,
        has_detail: Boolean(input.acquisitionDetail),
      });
      toast.success("Thanks, that helps a lot.");
      onDone();
    },
    onError: (error) => toast.error(error.message),
  });

  const dismiss = useDismissAcquisition(source, plan);

  const notNow = () => {
    dismiss();
    onDone();
  };

  const isDialog = variant === "dialog";
  const Body = isDialog ? DialogBody : "div";
  const Footer = isDialog ? DialogFooter : "div";

  return (
    <form onSubmit={handleSubmit((data) => submitMutation.mutate(data))}>
      <Body className={cn("grid gap-4", !isDialog && "md:grid-cols-3 md:gap-3")}>
        <div className="space-y-1.5">
          <Label htmlFor={fieldId("channel")} className={LABEL_CLASS}>
            How did you first hear about iShortn?
          </Label>
          <Controller
            name="acquisitionChannel"
            control={control}
            rules={{ required: "Pick where you heard about us" }}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value ?? ""}>
                <SelectTrigger
                  id={fieldId("channel")}
                  className={cn(FIELD_CLASS, errors.acquisitionChannel && "border-red-300")}
                >
                  <SelectValue placeholder="Pick one..." />
                </SelectTrigger>
                <SelectContent>
                  {ACQUISITION_CHANNEL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.acquisitionChannel && (
            <p className="text-[12px] text-red-500">{errors.acquisitionChannel.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={fieldId("detail")} className={LABEL_CLASS}>
            Where exactly?
            <span className="ml-1.5 text-[12px] font-normal text-neutral-400 dark:text-muted-foreground">
              optional
            </span>
          </Label>
          <Input
            id={fieldId("detail")}
            placeholder="Site, post, search or person"
            className={cn(
              FIELD_CLASS,
              "placeholder:text-neutral-400",
              errors.acquisitionDetail && "border-red-300",
            )}
            {...register("acquisitionDetail", {
              maxLength: { value: 2000, message: "Keep it under 2,000 characters" },
            })}
          />
          {errors.acquisitionDetail && (
            <p className="text-[12px] text-red-500">{errors.acquisitionDetail.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={fieldId("use-case")} className={LABEL_CLASS}>
            What will you mainly use it for?
            <span className="ml-1.5 text-[12px] font-normal text-neutral-400 dark:text-muted-foreground">
              optional
            </span>
          </Label>
          <Controller
            name="useCase"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value ?? ""}>
                <SelectTrigger id={fieldId("use-case")} className={FIELD_CLASS}>
                  <SelectValue placeholder="Pick one..." />
                </SelectTrigger>
                <SelectContent>
                  {USE_CASE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </Body>

      <Footer className={cn(!isDialog && "mt-4 flex items-center justify-end gap-2")}>
        <Button
          type="button"
          variant="ghost"
          onClick={notNow}
          disabled={submitMutation.isLoading}
          className="h-9 text-[13px]"
        >
          Not now
        </Button>
        <Button
          type="submit"
          disabled={submitMutation.isLoading}
          className="h-9 bg-blue-600 text-[13px] text-white hover:bg-blue-700"
        >
          {submitMutation.isLoading ? "Submitting..." : "Submit"}
        </Button>
      </Footer>
    </form>
  );
}
