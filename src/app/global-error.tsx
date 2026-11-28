"use client";

import "@/styles/globals.css";
import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { useVersionSkewReload } from "@/lib/hooks/use-version-skew-reload";
import { clientLogger } from "@/lib/logger/client";

// Replaces the root layout when it fails, so it renders its own <html> and
// can't rely on the theme provider or app fonts. Neutral copy: this can show on
// a customer's own short domain.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const reloading = useVersionSkewReload(error);

  useEffect(() => {
    clientLogger.error({ err: error, digest: error.digest }, "global error boundary caught error");
  }, [error]);

  // A stale tab after a deploy: the page is reloading onto the current build.
  if (reloading) {
    return (
      <html lang="en">
        <body className="bg-neutral-50" aria-busy="true" />
      </html>
    );
  }

  return (
    <html lang="en">
      <head>
        <title>Something went wrong</title>
        <meta name="robots" content="noindex" />
      </head>
      <body className="font-sans antialiased">
        <main className="flex min-h-[100dvh] items-center justify-center bg-neutral-50 px-4 py-12">
          <div className="w-full max-w-md text-center">
            <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
              <IconAlertTriangle size={24} stroke={1.5} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
              Something went wrong
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">
              This page couldn&apos;t load. Try again in a moment.
            </p>
            <Button
              type="button"
              onClick={reset}
              className="mt-8 gap-2 rounded-lg bg-blue-600 text-[13px] text-white hover:bg-blue-700"
            >
              <IconRefresh size={16} stroke={2} />
              Try again
            </Button>
          </div>
        </main>
      </body>
    </html>
  );
}
