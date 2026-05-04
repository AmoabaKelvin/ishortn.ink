"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
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
import type { Plan } from "@/lib/billing/plans";
import type { SubmitAudienceFeedbackInput } from "@/server/api/routers/audience-feedback/audience-feedback.input";
import { api } from "@/trpc/react";

const ROLE_OPTIONS = [
  { value: "founder", label: "Founder or owner" },
  { value: "marketer", label: "Marketer" },
  { value: "developer", label: "Developer or engineer" },
  { value: "agency", label: "Agency or freelancer" },
  { value: "creator", label: "Creator or influencer" },
  { value: "educator", label: "Educator or researcher" },
  { value: "other", label: "Something else" },
] as const;

const USE_CASE_OPTIONS = [
  { value: "social_media", label: "Social media bio or posts" },
  { value: "marketing_campaigns", label: "Marketing campaigns" },
  { value: "client_links", label: "Client work" },
  { value: "product_links", label: "Product or app links" },
  { value: "qr_codes", label: "QR codes for print or packaging" },
  { value: "internal_sharing", label: "Internal or team sharing" },
  { value: "other", label: "Something else" },
] as const;

const MONTHLY_VOLUME_OPTIONS = [
  { value: "1_10", label: "1 to 10 links" },
  { value: "11_50", label: "11 to 50 links" },
  { value: "51_200", label: "51 to 200 links" },
  { value: "201_1000", label: "201 to 1,000 links" },
  { value: "1000_plus", label: "1,000 or more links" },
] as const;

const ACQUISITION_CHANNEL_OPTIONS = [
  { value: "search", label: "Google or another search engine" },
  { value: "social", label: "Social media (X, Reddit, LinkedIn, etc.)" },
  { value: "friend_or_colleague", label: "A friend or colleague" },
  { value: "community", label: "A community or forum" },
  { value: "directory", label: "A directory or comparison article" },
  { value: "ad", label: "An advertisement" },
  { value: "other", label: "Somewhere else" },
] as const;

const PRIOR_TOOL_OPTIONS = [
  { value: "none", label: "Nothing — this is my first" },
  { value: "bitly", label: "Bitly" },
  { value: "dub", label: "Dub" },
  { value: "tinyurl", label: "TinyURL" },
  { value: "rebrandly", label: "Rebrandly" },
  { value: "shortio", label: "Short.io" },
  { value: "other", label: "Another tool" },
] as const;

const MAGIC_FEATURE_OPTIONS = [
  { value: "custom_domains", label: "Custom domains" },
  { value: "analytics", label: "Analytics" },
  { value: "qr_codes", label: "QR codes" },
  { value: "folders", label: "Folders and organization" },
  { value: "utm_templates", label: "UTM templates" },
  { value: "geo_rules", label: "Geo rules" },
  { value: "teams", label: "Teams and collaboration" },
  { value: "other", label: "Something else" },
] as const;

const UPGRADE_REASON_OPTIONS = [
  { value: "more_links", label: "Needed more links per month" },
  { value: "more_analytics", label: "Wanted deeper analytics" },
  { value: "custom_domains", label: "Needed custom domains" },
  { value: "teams", label: "Needed team collaboration" },
  { value: "geo_rules", label: "Needed geo targeting rules" },
  { value: "qr_codes", label: "Wanted QR codes" },
  { value: "support_the_product", label: "Wanted to support the product" },
  { value: "other", label: "Another reason" },
] as const;

type FormData = SubmitAudienceFeedbackInput;

type AudienceFeedbackModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: Plan;
};

const TOTAL_STEPS = 3;
const STEP_EASE = [0.32, 0.72, 0, 1] as const;

const stepVariants = {
  enter: (direction: 1 | -1) => ({
    x: direction === 1 ? 28 : -28,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: 1 | -1) => ({
    x: direction === 1 ? -28 : 28,
    opacity: 0,
  }),
};

export function AudienceFeedbackModal({
  open,
  onOpenChange,
  plan,
}: AudienceFeedbackModalProps) {
  const isPaidPlan = plan !== "free";
  const utils = api.useUtils();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<1 | -1>(1);

  const {
    control,
    register,
    handleSubmit,
    reset,
    trigger,
    formState: { errors },
  } = useForm<FormData>({ mode: "onTouched" });

  useEffect(() => {
    if (open) {
      setStep(1);
      setDirection(1);
    }
  }, [open]);

  const submitMutation = api.audienceFeedback.submit.useMutation({
    onSuccess: () => {
      toast.success("Thanks — this helps a lot.");
      reset();
      setStep(1);
      void utils.audienceFeedback.getStatus.invalidate();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send feedback");
    },
  });

  const dismissMutation = api.audienceFeedback.dismiss.useMutation({
    onSuccess: () => {
      void utils.audienceFeedback.getStatus.invalidate();
    },
  });

  const stepFields: Array<Array<keyof FormData>> = [
    ["role", "useCase", "monthlyVolume"],
    ["acquisitionChannel", "priorTool"],
    isPaidPlan
      ? ["magicFeature", "upgradeReason"]
      : ["magicFeature", "upgradeBlocker"],
  ];

  const goNext = async () => {
    const valid = await trigger(stepFields[step - 1]);
    if (!valid) return;
    setDirection(1);
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const goBack = () => {
    setDirection(-1);
    setStep((s) => Math.max(1, s - 1));
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      reset();
      setStep(1);
      setDirection(1);
    }
    onOpenChange(nextOpen);
  };

  const handleMaybeLater = () => {
    dismissMutation.mutate();
    handleClose(false);
  };

  const onSubmit = (data: FormData) => {
    submitMutation.mutate({
      ...data,
      upgradeReason: isPaidPlan ? data.upgradeReason ?? null : null,
      upgradeBlocker: isPaidPlan ? null : data.upgradeBlocker ?? null,
    });
  };

  const isBusy = submitMutation.isLoading || dismissMutation.isLoading;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader className="pb-3">
          <DialogTitle>Help shape iShortn</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody className="space-y-7 pt-1">
            <div className="flex gap-1.5">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <div
                  key={i}
                  className="relative h-0.5 flex-1 overflow-hidden rounded-full bg-neutral-200/80 dark:bg-border/60"
                >
                  <motion.div
                    className="absolute inset-0 origin-left rounded-full bg-neutral-900 dark:bg-foreground"
                    initial={false}
                    animate={{ scaleX: i < step ? 1 : 0 }}
                    transition={{
                      duration: 0.4,
                      ease: STEP_EASE,
                      delay: i < step ? 0.05 : 0,
                    }}
                  />
                </div>
              ))}
            </div>

            <motion.div
              layout
              transition={{ duration: 0.28, ease: STEP_EASE }}
              className="overflow-hidden"
            >
              <AnimatePresence
                mode="popLayout"
                custom={direction}
                initial={false}
              >
                <motion.div
                  key={step}
                  custom={direction}
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.22, ease: STEP_EASE }}
                >
                  {step === 1 && (
                    <StepAboutYou control={control} errors={errors} />
                  )}
                  {step === 2 && (
                    <StepDiscovery
                      control={control}
                      register={register}
                      errors={errors}
                    />
                  )}
                  {step === 3 && (
                    <StepWhatMatters
                      control={control}
                      register={register}
                      errors={errors}
                      isPaidPlan={isPaidPlan}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={handleMaybeLater}
              disabled={isBusy}
              className="h-9"
            >
              Maybe later
            </Button>
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={goBack}
                disabled={isBusy}
                className="h-9"
              >
                Back
              </Button>
            )}
            {step < TOTAL_STEPS ? (
              <Button
                type="button"
                onClick={goNext}
                disabled={isBusy}
                className="h-9"
              >
                Next
              </Button>
            ) : (
              <Button type="submit" disabled={isBusy} className="h-9">
                {submitMutation.isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send feedback"
                )}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type FieldOption = { value: string; label: string };

type SelectFieldProps = {
  name: keyof FormData;
  label: string;
  placeholder: string;
  options: readonly FieldOption[];
  control: Control<FormData>;
  errors: FieldErrors<FormData>;
  required?: string;
};

function SelectField({
  name,
  label,
  placeholder,
  options,
  control,
  errors,
  required = "Please pick an option",
}: SelectFieldProps) {
  const error = errors[name];
  return (
    <div className="space-y-2">
      <Label htmlFor={name} className="text-[13px] font-medium text-foreground">
        {label}
      </Label>
      <Controller
        name={name}
        control={control}
        rules={{ required }}
        render={({ field }) => (
          <Select
            onValueChange={field.onChange}
            value={(field.value as string | undefined) ?? ""}
          >
            <SelectTrigger
              id={name}
              className={cn("h-10", error && "border-destructive")}
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {error?.message && (
        <p className="text-xs text-destructive">{String(error.message)}</p>
      )}
    </div>
  );
}

type TextareaFieldProps = {
  name: keyof FormData;
  label: string;
  placeholder: string;
  register: UseFormRegister<FormData>;
  errors: FieldErrors<FormData>;
  required?: string;
  rows?: number;
};

function TextareaField({
  name,
  label,
  placeholder,
  register,
  errors,
  required,
  rows = 3,
}: TextareaFieldProps) {
  const error = errors[name];
  return (
    <div className="space-y-2">
      <Label
        htmlFor={name}
        className="flex items-center gap-1.5 text-[13px] font-medium text-foreground"
      >
        <span>{label}</span>
        {!required && (
          <span className="text-[11px] font-normal text-muted-foreground/70">
            optional
          </span>
        )}
      </Label>
      <Textarea
        id={name}
        placeholder={placeholder}
        rows={rows}
        className={cn(
          "resize-none text-sm",
          error && "border-destructive",
        )}
        {...register(name, {
          required,
          maxLength: {
            value: 2000,
            message: "Keep it under 2000 characters",
          },
        })}
      />
      {error?.message && (
        <p className="text-xs text-destructive">{String(error.message)}</p>
      )}
    </div>
  );
}

function StepAboutYou({
  control,
  errors,
}: {
  control: Control<FormData>;
  errors: FieldErrors<FormData>;
}) {
  return (
    <div className="space-y-5">
      <SelectField
        name="role"
        label="What best describes you?"
        placeholder="Pick a role..."
        options={ROLE_OPTIONS}
        control={control}
        errors={errors}
      />
      <SelectField
        name="useCase"
        label="What do you mainly use iShortn for?"
        placeholder="Pick a use case..."
        options={USE_CASE_OPTIONS}
        control={control}
        errors={errors}
      />
      <SelectField
        name="monthlyVolume"
        label="Roughly how many links do you create each month?"
        placeholder="Pick a range..."
        options={MONTHLY_VOLUME_OPTIONS}
        control={control}
        errors={errors}
      />
    </div>
  );
}

function StepDiscovery({
  control,
  register,
  errors,
}: {
  control: Control<FormData>;
  register: UseFormRegister<FormData>;
  errors: FieldErrors<FormData>;
}) {
  return (
    <div className="space-y-5">
      <SelectField
        name="acquisitionChannel"
        label="How did you hear about iShortn?"
        placeholder="Pick a channel..."
        options={ACQUISITION_CHANNEL_OPTIONS}
        control={control}
        errors={errors}
      />
      <TextareaField
        name="acquisitionDetail"
        label="Where exactly?"
        placeholder="A specific site, person, post, or video helps a lot."
        register={register}
        errors={errors}
        rows={2}
      />
      <SelectField
        name="priorTool"
        label="What were you using before iShortn?"
        placeholder="Pick a tool..."
        options={PRIOR_TOOL_OPTIONS}
        control={control}
        errors={errors}
      />
      <TextareaField
        name="switchReason"
        label="What made you switch (or try us out)?"
        placeholder="Price, a missing feature, the UI, hit a limit..."
        register={register}
        errors={errors}
        rows={2}
      />
    </div>
  );
}

function StepWhatMatters({
  control,
  register,
  errors,
  isPaidPlan,
}: {
  control: Control<FormData>;
  register: UseFormRegister<FormData>;
  errors: FieldErrors<FormData>;
  isPaidPlan: boolean;
}) {
  return (
    <div className="space-y-5">
      <SelectField
        name="magicFeature"
        label="Which feature matters most to you?"
        placeholder="Pick a feature..."
        options={MAGIC_FEATURE_OPTIONS}
        control={control}
        errors={errors}
      />
      {isPaidPlan ? (
        <SelectField
          name="upgradeReason"
          label="What pushed you to upgrade?"
          placeholder="Pick a reason..."
          options={UPGRADE_REASON_OPTIONS}
          control={control}
          errors={errors}
        />
      ) : (
        <TextareaField
          name="upgradeBlocker"
          label="What's holding you back from upgrading?"
          placeholder="Price, missing features, just exploring..."
          register={register}
          errors={errors}
          required="Tell us what's holding you back"
          rows={3}
        />
      )}
      <TextareaField
        name="improvementWish"
        label="One thing that would make iShortn dramatically more useful?"
        placeholder="Anything goes — features, fixes, integrations."
        register={register}
        errors={errors}
        rows={3}
      />
    </div>
  );
}
