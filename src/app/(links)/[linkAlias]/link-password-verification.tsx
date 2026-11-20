"use client";

import { IconLock } from "@tabler/icons-react";
import { TRPCClientError } from "@trpc/client";
import { useTransitionRouter } from "next-view-transitions";
import { Funnel_Sans } from "next/font/google";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { api, TRPCReactProvider } from "@/trpc/react";

import type { AppRouter } from "@/server/api/root";
import type { TRPCClientErrorLike } from "@trpc/client";

const funnelSans = Funnel_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const GENERIC_ERROR = "Something went wrong, try again";

function errorMessage(error: TRPCClientErrorLike<AppRouter>): string {
  if (error.data?.code === "TOO_MANY_REQUESTS") return "Too many attempts, try again later";
  if (error.data?.code === "BAD_REQUEST") return "Wrong password, try again";
  return GENERIC_ERROR;
}

// The root layout has no tRPC provider (short-link pages ship without it), so
// the one short-link screen that calls tRPC brings its own.
export const LinkPasswordVerification = ({ id }: { id: number }) => (
  <TRPCReactProvider>
    <PasswordForm id={id} />
  </TRPCReactProvider>
);

const PasswordForm = ({ id }: { id: number }) => {
  const verifyPasswordMutation = api.link.verifyLinkPassword.useMutation();
  const router = useTransitionRouter();
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const password = String(formData.get("password") ?? "");
    setError(null);

    let result;
    try {
      result = await verifyPasswordMutation.mutateAsync({ id, password });
    } catch (err) {
      setError(err instanceof TRPCClientError ? errorMessage(err) : GENERIC_ERROR);
      return;
    }

    if (!result.url) {
      setError(GENERIC_ERROR);
      return;
    }

    setRedirecting(true);

    // When the link has verified clicks on, route through the interstitial
    // page so the beacon fires. Force a full navigation (not router.push)
    // because the interstitial relies on an inline <script> that only runs
    // reliably on a fresh page load.
    if (result.verificationToken) {
      const alias = encodeURIComponent(result.alias ?? "l");
      const to = encodeURIComponent(result.url);
      const t = encodeURIComponent(result.verificationToken);
      window.location.href = `/verified-redirect/${alias}?to=${to}&t=${t}`;
      return;
    }

    router.push(result.url);
  };

  const busy = verifyPasswordMutation.isLoading || redirecting;

  return (
    <div
      className={cn(
        "flex min-h-screen items-center justify-center bg-neutral-50 px-4 dark:bg-accent/50",
        funnelSans.className,
      )}
    >
      <div className="w-full max-w-sm">
        <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 dark:bg-muted">
          <IconLock size={24} stroke={1.5} className="text-neutral-600 dark:text-neutral-300" />
        </div>
        <h1 className="text-center text-xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
          This link is password protected
        </h1>
        <p className="mt-2 text-center text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400">
          Enter the password to continue to the destination.
        </p>

        <form className="mt-6 space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label
              htmlFor="link-password"
              className="text-[13px] text-neutral-700 dark:text-neutral-300"
            >
              Password
            </Label>
            <Input
              id="link-password"
              type="password"
              name="password"
              autoComplete="current-password"
              required
              // oxlint-disable-next-line jsx-a11y/no-autofocus -- entering the password is the page's only task
              autoFocus
              maxLength={256}
              aria-invalid={!!error}
              aria-describedby={error ? "link-password-error" : undefined}
              className="text-[13px]"
            />
            {error && (
              <p id="link-password-error" role="alert" className="text-[12px] text-red-500">
                {error}
              </p>
            )}
          </div>
          <Button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-blue-600 text-[13px] text-white hover:bg-blue-700"
          >
            {busy ? "Unlocking..." : "Unlock link"}
          </Button>
        </form>
      </div>
    </div>
  );
};
