"use client";

import { IconBrowser, IconPlugConnectedX } from "@tabler/icons-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

import { revalidateRoute } from "@/app/(main)/dashboard/revalidate-homepage";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api } from "@/trpc/react";

import type { RouterOutputs } from "@/trpc/shared";

type Browser = RouterOutputs["token"]["listExtensions"][number];

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

export function ConnectedBrowsers({
  browsers,
  docsUrl,
}: {
  browsers: RouterOutputs["token"]["listExtensions"];
  docsUrl: string;
}) {
  if (browsers.length === 0) {
    return (
      <div className="py-6 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 dark:bg-muted">
          <IconBrowser size={18} stroke={1.5} className="text-neutral-400 dark:text-neutral-500" />
        </div>
        <p className="text-[14px] font-medium text-neutral-900 dark:text-foreground">
          No Connected Browsers
        </p>
        <p className="mx-auto mt-1 max-w-sm text-[12px] text-neutral-400 dark:text-neutral-500">
          Shorten the page you&apos;re on, copy the link and get its QR code from your browser
          toolbar.{" "}
          <a
            href={docsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Get the extension
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-neutral-300/60 rounded-lg border border-neutral-200 bg-white dark:divide-border dark:border-border dark:bg-card">
      {browsers.map((browser) => (
        <BrowserRow key={browser.id} browser={browser} />
      ))}
    </div>
  );
}

function BrowserRow({ browser }: { browser: Browser }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const label = browser.label ?? "Browser extension";

  const disconnect = api.token.disconnectExtension.useMutation({
    onSuccess: async () => {
      toast.success("Browser disconnected");
      setConfirmOpen(false);
      await revalidateRoute("/dashboard/settings");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-100 dark:bg-muted">
        <IconBrowser size={15} stroke={1.5} className="text-neutral-400 dark:text-neutral-500" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-[13px] font-medium text-neutral-900 dark:text-foreground">
            {label}
          </p>
          {browser.prefix && (
            <code className="flex-shrink-0 rounded-md bg-neutral-50 px-1.5 py-0.5 font-mono text-[11px] text-neutral-500 dark:bg-accent/50 dark:text-neutral-400">
              {browser.prefix}••••
            </code>
          )}
        </div>
        <p className="mt-0.5 truncate text-[12px] text-neutral-400 dark:text-neutral-500">
          {browser.createdAt && <>Connected {formatDate(browser.createdAt)} &middot; </>}
          {browser.lastUsedAt ? (
            <span title={browser.lastUsedAt.toLocaleString()}>
              Last used {formatDistanceToNow(browser.lastUsedAt, { addSuffix: true })}
            </span>
          ) : (
            "Never used"
          )}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        aria-label={`Disconnect ${label}`}
        className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-[12px] font-medium text-red-600 transition-colors hover:border-red-200 hover:bg-red-50 dark:border-border dark:text-red-400 dark:hover:border-red-800 dark:hover:bg-red-500/10"
      >
        <IconPlugConnectedX size={13} stroke={1.5} />
        <span className="hidden sm:inline">Disconnect</span>
      </button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-md rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[14px] font-semibold text-neutral-900 dark:text-foreground">
              Disconnect browser?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[12px] text-neutral-500 dark:text-neutral-400">
              The iShortn extension in{" "}
              <span className="break-all font-medium text-neutral-700 dark:text-neutral-300">
                {label}
              </span>{" "}
              will be signed out. Links it created stay in your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg border-neutral-200 text-[13px] dark:border-border">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                disconnect.mutate({ id: browser.id });
              }}
              disabled={disconnect.isLoading}
              className="rounded-lg bg-red-600 text-[13px] text-white hover:bg-red-700 disabled:opacity-50"
            >
              {disconnect.isLoading ? "Disconnecting..." : "Disconnect"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
