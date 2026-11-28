"use client";

import { IconAlertCircle, IconRefresh } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useVersionSkewReload } from "@/lib/hooks/use-version-skew-reload";
import { clientLogger } from "@/lib/logger/client";

import { FeedbackModal } from "./_components/navigation/feedback-modal";
import { buildClientErrorReport } from "./_lib/client-error-report";
import { reportClientError } from "./report-client-error";

// The boundary remounts when a retry throws again, so component state can't
// remember the retry; a module-level timestamp does.
const RETRY_WINDOW_MS = 10_000;
let lastRetryAt = 0;

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [retryFailed] = useState(() => Date.now() - lastRetryAt < RETRY_WINDOW_MS);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const reloading = useVersionSkewReload(error);

  useEffect(() => {
    clientLogger.error(
      { err: error, digest: error.digest, retryFailed },
      "dashboard error boundary caught error",
    );
    // Browser consoles aren't collected; this puts the message and digest in the Worker logs.
    reportClientError(buildClientErrorReport("dashboard", error, window.location.pathname)).catch(
      () => {},
    );
  }, [error, retryFailed]);

  const retry = () => {
    lastRetryAt = Date.now();
    // refresh() refetches server components; reset() alone only re-renders the client tree.
    startTransition(() => {
      router.refresh();
      reset();
    });
  };

  // A stale tab after a deploy: the page is reloading onto the current build.
  if (reloading) return <div className="min-h-[400px]" aria-busy="true" />;

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-red-50 dark:bg-red-500/10">
        <IconAlertCircle size={24} stroke={1.5} className="text-red-600 dark:text-red-400" />
      </div>
      <p className="mt-6 text-[14px] font-medium text-neutral-900 dark:text-foreground">
        Something went wrong
      </p>
      <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400">
        {retryFailed
          ? "This page still isn't loading. Head back to the dashboard, or "
          : "We couldn't load this page. Try again, or "}
        <button
          type="button"
          onClick={() => setIsFeedbackOpen(true)}
          className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
        >
          contact support
        </button>
        {retryFailed ? " if it keeps happening." : " if the problem persists."}
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-[11px] break-all text-neutral-400 dark:text-muted-foreground">
          Reference: {error.digest}
        </p>
      )}
      {process.env.NODE_ENV === "development" && error.message && (
        <p className="mt-3 max-w-md rounded-lg bg-red-50 p-2 font-mono text-[12px] break-all text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {error.message}
        </p>
      )}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
        {retryFailed ? (
          <>
            <Button type="button" variant="outline" onClick={retry} className="text-[13px]">
              <IconRefresh size={14} stroke={1.5} />
              Try again
            </Button>
            <Button
              asChild
              className="rounded-lg bg-blue-600 text-[13px] text-white hover:bg-blue-700"
            >
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          </>
        ) : (
          <>
            <Button asChild variant="outline" className="text-[13px]">
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
            <Button
              type="button"
              onClick={retry}
              className="rounded-lg bg-blue-600 text-[13px] text-white hover:bg-blue-700"
            >
              <IconRefresh size={14} stroke={2} />
              Try again
            </Button>
          </>
        )}
      </div>
      <FeedbackModal open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen} />
    </div>
  );
}
