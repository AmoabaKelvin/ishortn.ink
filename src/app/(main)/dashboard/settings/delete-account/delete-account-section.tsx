"use client";

import { useClerk } from "@clerk/nextjs";
import { IconLoader2 } from "@tabler/icons-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DELETION_GRACE_PERIOD_DAYS } from "@/lib/account-deletion/constants";
import {
  ACCOUNT_DELETION_DESTINATION_OPTIONS,
  ACCOUNT_DELETION_REASON_OPTIONS,
} from "@/lib/account-deletion/labels";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import type { RequestAccountDeletionInput } from "@/server/api/routers/account-deletion/account-deletion.input";

type FormData = RequestAccountDeletionInput;

export function DeleteAccountSection() {
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const { data: status, isLoading } = api.accountDeletion.status.useQuery();

  const {
    control,
    register,
    handleSubmit,
    reset,
    trigger,
    formState: { errors },
  } = useForm<FormData>({ mode: "onTouched" });

  // useWatch, not watch(): the React Compiler can't memoize watch's return.
  const reason = useWatch({ control, name: "reason" });

  const deleteMutation = api.accountDeletion.request.useMutation({
    onSuccess: () => {
      void signOut({ redirectUrl: "/" });
    },
    onError: (error) => toast.error(error.message || "Couldn't delete your account"),
  });

  const close = (nextOpen: boolean) => {
    if (!nextOpen) {
      reset();
      setStep(1);
    }
    setOpen(nextOpen);
  };

  const goToConfirm = async () => {
    if (await trigger(["reason", "destination", "improvement"])) setStep(2);
  };

  const ownedTeams = status?.ownedTeams ?? [];
  const blockedByTeams = ownedTeams.length > 0;

  return (
    <>
      <div className="rounded-xl border border-red-200 dark:border-red-900/50 p-5">
        <p className="text-[13px] font-medium text-neutral-900 dark:text-foreground">
          Delete this account
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-neutral-500 dark:text-neutral-400">
          Your links and bio pages stop working right away. Everything is kept for{" "}
          {DELETION_GRACE_PERIOD_DAYS} days — sign back in within that window to restore it. After
          that it&apos;s permanently deleted.
        </p>

        {blockedByTeams && (
          <p className="mt-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-300">
            You own {ownedTeams.map((t) => t.name).join(", ")}. Delete or transfer{" "}
            {ownedTeams.length > 1 ? "those teams" : "that team"} first.
          </p>
        )}

        <Button
          type="button"
          variant="outline"
          className="mt-4 h-9 border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
          disabled={isLoading || blockedByTeams || !status?.email}
          onClick={() => setOpen(true)}
        >
          Delete account
        </Button>
      </div>

      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader className="pb-3">
            <DialogTitle>{step === 1 ? "Before you go" : "Delete your account"}</DialogTitle>
            <DialogDescription>
              {step === 1
                ? "Two quick questions. They go straight to the person who builds iShortn."
                : "This stops your links immediately and starts the 30-day countdown."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit((data) => deleteMutation.mutate(data))}>
            <DialogBody className="space-y-5 pt-1">
              {step === 1 ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="reason" className="text-[13px] font-medium text-foreground">
                      What&apos;s the main reason you&apos;re leaving?
                    </Label>
                    <Controller
                      name="reason"
                      control={control}
                      rules={{ required: "Pick the closest one" }}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value ?? ""}>
                          <SelectTrigger
                            id="reason"
                            className={cn("h-10", errors.reason && "border-destructive")}
                          >
                            <SelectValue placeholder="Pick a reason..." />
                          </SelectTrigger>
                          <SelectContent>
                            {ACCOUNT_DELETION_REASON_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.reason?.message && (
                      <p className="text-xs text-destructive">{String(errors.reason.message)}</p>
                    )}
                  </div>

                  {reason === "found_alternative" && (
                    <div className="space-y-2">
                      <Label
                        htmlFor="destination"
                        className="flex items-center gap-1.5 text-[13px] font-medium text-foreground"
                      >
                        <span>Which tool are you moving to?</span>
                        <span className="text-[11px] font-normal text-muted-foreground/70">
                          optional
                        </span>
                      </Label>
                      <Controller
                        name="destination"
                        control={control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value ?? ""}>
                            <SelectTrigger id="destination" className="h-10">
                              <SelectValue placeholder="Pick a tool..." />
                            </SelectTrigger>
                            <SelectContent>
                              {ACCOUNT_DELETION_DESTINATION_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label
                      htmlFor="improvement"
                      className="flex items-center gap-1.5 text-[13px] font-medium text-foreground"
                    >
                      <span>What could we have done better?</span>
                      <span className="text-[11px] font-normal text-muted-foreground/70">
                        optional
                      </span>
                    </Label>
                    <Textarea
                      id="improvement"
                      rows={3}
                      placeholder="The thing that annoyed you, the feature that never showed up, the bug you kept hitting..."
                      className="resize-none text-sm"
                      {...register("improvement", {
                        maxLength: { value: 2000, message: "Keep it under 2000 characters" },
                      })}
                    />
                    {errors.improvement?.message && (
                      <p className="text-xs text-destructive">
                        {String(errors.improvement.message)}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <ul className="space-y-1.5 rounded-lg border border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/30 p-3 text-[12px] text-neutral-600 dark:text-neutral-400">
                    <li>• Your short links and bio pages stop resolving immediately.</li>
                    <li>• API keys stop working immediately.</li>
                    <li>• Any paid subscription is cancelled.</li>
                    <li>
                      • Everything is permanently deleted after {DELETION_GRACE_PERIOD_DAYS} days.
                      Sign back in before then to restore it.
                    </li>
                  </ul>

                  <div className="space-y-2">
                    <Label
                      htmlFor="confirmEmail"
                      className="text-[13px] font-medium text-foreground"
                    >
                      Type <span className="font-mono">{status?.email}</span> to confirm
                    </Label>
                    <Input
                      id="confirmEmail"
                      autoComplete="off"
                      placeholder={status?.email ?? "your@email.com"}
                      className={cn("h-10", errors.confirmEmail && "border-destructive")}
                      {...register("confirmEmail", {
                        required: "Type your email to confirm",
                        validate: (value) =>
                          value.trim().toLowerCase() === status?.email?.toLowerCase() ||
                          "That doesn't match your account email",
                      })}
                    />
                    {errors.confirmEmail?.message && (
                      <p className="text-xs text-destructive">
                        {String(errors.confirmEmail.message)}
                      </p>
                    )}
                  </div>
                </>
              )}
            </DialogBody>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                className="h-9"
                disabled={deleteMutation.isLoading}
                onClick={() => (step === 1 ? close(false) : setStep(1))}
              >
                {step === 1 ? "Cancel" : "Back"}
              </Button>
              {step === 1 ? (
                <Button type="button" className="h-9" onClick={goToConfirm}>
                  Continue
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="destructive"
                  className="h-9"
                  disabled={deleteMutation.isLoading}
                >
                  {deleteMutation.isLoading && (
                    <IconLoader2 size={14} stroke={1.5} className="animate-spin" />
                  )}
                  Delete my account
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
