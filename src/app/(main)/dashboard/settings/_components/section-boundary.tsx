"use client";

import { IconAlertCircle, IconRefresh } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { Component, startTransition } from "react";

import { Button } from "@/components/ui/button";
import { clientLogger } from "@/lib/logger/client";

import { buildClientErrorReport } from "../../_lib/client-error-report";
import { reportClientError } from "../../report-client-error";

import type { ErrorInfo, ReactNode } from "react";

type BoundaryProps = {
  section: string;
  onRetry: () => void;
  /** Rendered instead of the inline error panel, e.g. `null` for chrome the page works without. */
  fallback?: ReactNode;
  children: ReactNode;
};

type BoundaryState = { error: (Error & { digest?: string }) | null };

export class SectionErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error & { digest?: string }, info: ErrorInfo) {
    const boundary = `settings:${this.props.section}`;
    clientLogger.error({ err: error, digest: error.digest, boundary }, "settings section crashed");
    reportClientError(
      buildClientErrorReport(boundary, error, window.location.pathname, info.componentStack),
    ).catch(() => {});
  }

  retry = () => {
    // refresh() refetches the server data the section renders; resetting alone re-renders it as is.
    startTransition(() => {
      this.props.onRetry();
      this.setState({ error: null });
    });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;

    return (
      <div
        role="alert"
        className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-border"
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
          onClick={this.retry}
          className="h-8 w-fit shrink-0 border-neutral-200 text-[12px] dark:border-border"
        >
          <IconRefresh size={14} stroke={1.5} />
          Try again
        </Button>
      </div>
    );
  }
}

/** Keeps one settings section's render error inside that section instead of the whole page. */
export function SectionBoundary({
  section,
  fallback,
  children,
}: {
  section: string;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <SectionErrorBoundary section={section} fallback={fallback} onRetry={() => router.refresh()}>
      {children}
    </SectionErrorBoundary>
  );
}
