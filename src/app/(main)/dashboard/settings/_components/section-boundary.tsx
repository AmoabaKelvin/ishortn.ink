"use client";

import { IconAlertCircle, IconRefresh } from "@tabler/icons-react";
import { Component } from "react";

import { Button } from "@/components/ui/button";
import { useVersionSkewReload } from "@/lib/hooks/use-version-skew-reload";
import { clientLogger } from "@/lib/logger/client";

import { buildClientErrorReport, sendClientErrorReport } from "../../_lib/client-error-report";

import type { ErrorInfo, ReactNode } from "react";

// Full reload, not router.refresh(): refresh keeps the client modules already loaded, so a
// section broken by a stale build would throw again on every retry.
const reloadPage = () => window.location.reload();

type BoundaryProps = {
  section: string;
  /** Rendered instead of the inline error panel, e.g. `null` for chrome the page works without. */
  fallback?: ReactNode;
  /** Overridable for tests. */
  reload?: () => void;
  children: ReactNode;
};

type CaughtError = Error & { digest?: string };
type BoundaryState = { error: CaughtError | null };

/** Keeps one settings section's render error inside that section instead of the whole page. */
export class SectionBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: CaughtError, info: ErrorInfo) {
    const boundary = `settings:${this.props.section}`;
    clientLogger.error({ err: error, digest: error.digest, boundary }, "settings section crashed");
    sendClientErrorReport(
      buildClientErrorReport(boundary, error, window.location.pathname, info.componentStack),
    );
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <SectionError
        error={error}
        fallback={this.props.fallback}
        reload={this.props.reload ?? reloadPage}
      />
    );
  }
}

function SectionError({
  error,
  fallback,
  reload,
}: {
  error: CaughtError;
  fallback: ReactNode | undefined;
  reload: () => void;
}) {
  // A stale tab after a deploy: reload once onto the current build, the same recovery
  // dashboard/error.tsx runs, instead of showing a panel whose retry can't fix it.
  const reloading = useVersionSkewReload(error, reload);
  if (reloading) return null;
  if (fallback !== undefined) return fallback;

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between dark:border-border dark:bg-card"
    >
      <div className="flex min-w-0 items-start gap-2">
        <IconAlertCircle
          size={16}
          stroke={1.5}
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-red-600 dark:text-red-400"
        />
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-neutral-900 dark:text-foreground">
            This section couldn&apos;t load
          </p>
          <p className="mt-0.5 text-[12px] text-neutral-500 dark:text-neutral-400">
            The rest of your settings still work. Try again, or contact support if it keeps
            happening.
          </p>
          {error.digest && (
            <p className="mt-1 font-mono text-[11px] break-all text-neutral-400 dark:text-muted-foreground">
              Reference: {error.digest}
            </p>
          )}
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={reload}
        className="h-8 w-fit shrink-0 border-neutral-200 text-[12px] dark:border-border"
      >
        <IconRefresh size={14} stroke={1.5} />
        Try again
      </Button>
    </div>
  );
}
