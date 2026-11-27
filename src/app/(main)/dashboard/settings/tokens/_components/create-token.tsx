"use client";

import { IconAlertTriangle, IconCheck, IconCopy } from "@tabler/icons-react";
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
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { cn } from "@/lib/utils";
import { TOKEN_NAME_MAX_LENGTH } from "@/server/api/routers/token/token.input";
import { api } from "@/trpc/react";

import type { CreateTokenInput } from "@/server/api/routers/token/token.input";

export function CreateTokenDialog({
  trigger,
  team = false,
}: {
  trigger: React.ReactNode;
  /** Creates a key for the current team workspace instead of a personal one. */
  team?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTokenInput>({ defaultValues: { name: "" } });

  const createOptions = {
    onSuccess: async (created: { token: string }) => {
      setKey(created.token);
      trackEvent(POSTHOG_EVENTS.API_KEY_CREATED);
      await revalidateRoute("/dashboard/settings");
    },
    onError: (error: { message: string }) => {
      toast.error(error.message);
    },
  };
  const createPersonal = api.token.create.useMutation(createOptions);
  const createTeam = api.token.createTeam.useMutation(createOptions);
  const createTokenMutation = team ? createTeam : createPersonal;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      // The plaintext key only lives in this dialog; drop it once it closes.
      setKey(null);
      setCopied(false);
      reset();
    }
  };

  const handleCopy = async () => {
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the key. Select it and copy it manually.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        {key ? (
          <>
            <DialogHeader>
              <DialogTitle>Your API key is ready</DialogTitle>
              <DialogDescription>
                Copy and save it somewhere safe. You won&apos;t be able to see it again.
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-3">
              {/* Key Display */}
              <div className="relative">
                <code className="block w-full break-all rounded-lg bg-neutral-900 px-3 py-3 pr-20 font-mono text-[12px] text-emerald-400">
                  {key}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  className={cn(
                    "absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                    copied
                      ? "bg-emerald-600 text-white"
                      : "bg-neutral-700 text-neutral-300 hover:bg-neutral-600",
                  )}
                >
                  {copied ? (
                    <>
                      <IconCheck size={12} stroke={1.5} />
                      Copied
                    </>
                  ) : (
                    <>
                      <IconCopy size={12} stroke={1.5} />
                      Copy
                    </>
                  )}
                </button>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-500/10">
                <IconAlertTriangle
                  size={15}
                  stroke={1.5}
                  className="mt-0.5 flex-shrink-0 text-amber-700 dark:text-amber-400"
                />
                <div>
                  <p className="text-[12px] font-medium text-amber-700 dark:text-amber-400">
                    Store this key securely
                  </p>
                  <p className="mt-0.5 text-[11px] text-amber-700/80 dark:text-amber-400/80">
                    {team
                      ? "This key grants access to this team workspace. Never share it or commit it to version control."
                      : "This key grants access to your account. Never share it or commit it to version control."}
                  </p>
                </div>
              </div>
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
              <DialogTitle>{team ? "Create Team API Key" : "Create API Key"}</DialogTitle>
              <DialogDescription>
                {team
                  ? "It acts in this team workspace and stays when members leave"
                  : "Name the key after the app or script that uses it"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit((data) => createTokenMutation.mutate(data))}>
              <DialogBody>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="token-name"
                    className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300"
                  >
                    Name
                  </Label>
                  <Input
                    id="token-name"
                    placeholder="e.g. Zapier integration"
                    maxLength={TOKEN_NAME_MAX_LENGTH}
                    autoComplete="off"
                    className={cn(
                      "h-9 border-neutral-200 bg-white text-[13px] placeholder:text-neutral-400 dark:border-border dark:bg-card",
                      errors.name && "border-red-300 focus-visible:ring-red-300",
                    )}
                    {...register("name", {
                      validate: (value) => value.trim().length > 0 || "Name is required",
                      maxLength: {
                        value: TOKEN_NAME_MAX_LENGTH,
                        message: `Name must be ${TOKEN_NAME_MAX_LENGTH} characters or less`,
                      },
                    })}
                  />
                  {errors.name && <p className="text-[12px] text-red-500">{errors.name.message}</p>}
                </div>
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
                  disabled={createTokenMutation.isLoading}
                  className="h-9 bg-blue-600 text-[13px] hover:bg-blue-700"
                >
                  {createTokenMutation.isLoading ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
