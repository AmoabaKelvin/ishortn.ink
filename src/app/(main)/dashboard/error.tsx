"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

import { clientLogger } from "@/lib/logger/client";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    clientLogger.error(
      { err: error, digest: error.digest },
      "dashboard error boundary caught error",
    );
  }, [error]);

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/10">
        <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-neutral-400 max-w-md">
          We encountered an error while loading this page. Please try again or
          contact support if the problem persists.
        </p>
        {process.env.NODE_ENV === "development" && error?.message && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400 font-mono bg-red-50 dark:bg-red-500/10 p-2 rounded max-w-md">
            {error.message}
          </p>
        )}
      </div>
      <div className="flex gap-3">
        <Button onClick={reset} variant="default" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
        <Button
          onClick={() => (window.location.href = "/dashboard")}
          variant="outline"
        >
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}
