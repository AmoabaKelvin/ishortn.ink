"use client";

import { IconCheck, IconCopy, IconRefresh } from "@tabler/icons-react";
import { useEffect, useState } from "react";
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
import { env } from "@/env.mjs";
import { copyToClipboard } from "@/lib/utils";
import { api } from "@/trpc/react";

import type { RouterOutputs } from "@/trpc/shared";

const SESSION_DISMISS_KEY = "ishortn:domain-migration-dismissed";

export const DOMAIN_MIGRATION_OPEN_EVENT = "ishortn:domain-migration:open";

type MigrationDomain = RouterOutputs["customDomain"]["migrationStatus"][number];

function migrationDeadline(): { label: string; passed: boolean } | null {
  const deadline = env.NEXT_PUBLIC_DOMAIN_MIGRATION_DEADLINE;
  if (!deadline) return null;

  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) return null;

  return {
    label: parsed.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }),
    passed: parsed.getTime() < Date.now(),
  };
}

export function DomainMigrationGate() {
  // Starts closed on both server and client; the effect below reads the
  // session dismissal after hydration, avoiding a mismatch.
  const [dismissed, setDismissed] = useState(true);

  const { data } = api.customDomain.migrationStatus.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    setDismissed(window.sessionStorage.getItem(SESSION_DISMISS_KEY) === "1");

    const handleOpen = () => {
      window.sessionStorage.removeItem(SESSION_DISMISS_KEY);
      setDismissed(false);
    };

    window.addEventListener(DOMAIN_MIGRATION_OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(DOMAIN_MIGRATION_OPEN_EVENT, handleOpen);
  }, []);

  const pendingDomains = data?.filter((entry) => !entry.cloudflareActive) ?? [];

  if (pendingDomains.length === 0) {
    return null;
  }

  const dismissForSession = () => {
    window.sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
    setDismissed(true);
  };

  // No configured deadline means the move already happened.
  const deadline = migrationDeadline();
  const deadlinePassed = deadline?.passed ?? true;
  const onDeadline = deadline ? ` on ${deadline.label}` : "";

  return (
    <Dialog open={!dismissed}>
      <DialogContent
        className="max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-[560px] [&>button]:hidden"
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {deadlinePassed ? "Your custom domains need a DNS update" : "DNS update required"}
          </DialogTitle>
          <DialogDescription className="text-[13px]">
            {deadlinePassed
              ? `ishortn now runs on a faster, more reliable network. We shared the move by email and in the app ahead of time, and the old network was switched off${onDeadline}. If this is the first you are seeing it, no worries: links on the domains below will work again once their DNS records point to the new network. It is a single record change per domain, and you can verify it right here.`
              : `ishortn is moving to a faster, more reliable network${onDeadline}. To bring your custom domains along, update their DNS records at your provider. It is a single record change per domain.`}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 overflow-y-auto">
          {pendingDomains.map((entry) => (
            <DomainMigrationSection key={entry.domain} entry={entry} />
          ))}
        </DialogBody>

        <DialogFooter className="sm:items-center sm:justify-between">
          <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
            This notice returns each session until every domain is updated.
          </p>
          <Button
            type="button"
            variant="ghost"
            onClick={dismissForSession}
            className="h-9 shrink-0 text-[13px]"
          >
            I&apos;ll do this later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type VerifyFeedback = "pending" | "error";

const feedbackMessages: Record<VerifyFeedback, string> = {
  pending:
    "Records not detected yet. DNS changes can take up to 48 hours to propagate — check again later.",
  error: "We could not verify the domain right now. Please try again in a moment.",
};

function DomainMigrationSection({ entry }: { entry: MigrationDomain }) {
  const [feedback, setFeedback] = useState<VerifyFeedback | null>(null);
  const utils = api.useUtils();

  const checkStatus = api.customDomain.checkStatus.useQuery(
    { domain: entry.domain },
    { enabled: false, retry: false },
  );

  const isApexDomain = entry.records.some(
    (record) => record.type === "CNAME" && record.name === "@",
  );

  const handleVerify = async () => {
    setFeedback(null);
    const { data: result } = await checkStatus.refetch();

    if (!result) {
      setFeedback("error");
      return;
    }

    if (result.status === "active") {
      toast.success(`${entry.domain} is all set — no further action needed`);
      await utils.customDomain.migrationStatus.invalidate();
      return;
    }

    setFeedback("pending");
  };

  const isVerifying = checkStatus.isFetching;

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[13px] font-medium text-neutral-900 dark:text-foreground">
            {entry.domain}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
            Needs update
          </span>
        </div>
        <button
          type="button"
          onClick={handleVerify}
          disabled={isVerifying}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-blue-600 dark:text-blue-400 transition-colors hover:bg-blue-50 dark:hover:bg-blue-500/10 disabled:opacity-50"
        >
          <IconRefresh size={12} stroke={1.5} className={isVerifying ? "animate-spin" : ""} />
          {isVerifying ? "Verifying..." : "Verify configuration"}
        </button>
      </div>

      {entry.fetchError && (
        <p className="mt-2 text-[11px] text-neutral-400 dark:text-neutral-500">
          We could not confirm this domain&apos;s current status. If you already updated the
          records, use &quot;Verify configuration&quot; to check again.
        </p>
      )}

      <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 dark:border-border">
        <table className="min-w-full divide-y divide-neutral-100">
          <thead className="bg-neutral-50 dark:bg-accent/50">
            <tr>
              <th className="px-3 py-2 text-left text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
                Type
              </th>
              <th className="px-3 py-2 text-left text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
                Name
              </th>
              <th className="px-3 py-2 text-left text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
                Value
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 bg-white dark:bg-card">
            {entry.records.map((record) => (
              <tr key={`${record.type}-${record.name}-${record.value}`}>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <span className="inline-flex items-center rounded-md border border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50 px-1.5 py-0.5 text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                    {record.type}
                  </span>
                  {record.type === "TXT" && (
                    <span className="ml-1.5 text-[10px] text-neutral-400 dark:text-neutral-500">
                      optional
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <CopyableValue value={record.name} />
                </td>
                <td className="px-3 py-2.5">
                  <CopyableValue value={record.value} truncate />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isApexDomain && (
        <div className="mt-3 rounded-lg border border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50 p-3">
          <p className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
            Using an apex domain?
          </p>
          <p className="mt-0.5 text-[11px] text-neutral-400 dark:text-neutral-500">
            Apex domains need a DNS provider that supports ALIAS, ANAME, or flattened CNAME records
            — for example Cloudflare, Namecheap, Porkbun, or Route 53. Create the CNAME record above
            as an ALIAS or ANAME record pointing to the same value.
          </p>
        </div>
      )}

      {feedback && (
        <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
          {feedbackMessages[feedback]}
        </p>
      )}
    </div>
  );
}

function CopyableValue({ value, truncate }: { value: string; truncate?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyToClipboard(value);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-1">
      <code
        className={`rounded-md border border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50 px-2 py-1 text-[11px] text-neutral-600 dark:text-neutral-400 ${
          truncate ? "max-w-[180px] truncate" : ""
        }`}
      >
        {value}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copy ${value}`}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-neutral-400 dark:text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-accent hover:text-neutral-600 dark:hover:text-neutral-300"
      >
        {copied ? (
          <IconCheck size={12} stroke={1.5} className="text-emerald-500" />
        ) : (
          <IconCopy size={12} stroke={1.5} />
        )}
      </button>
    </div>
  );
}
