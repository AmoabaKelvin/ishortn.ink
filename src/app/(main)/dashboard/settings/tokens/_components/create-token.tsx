"use client";

import { IconAlertTriangle, IconCheck, IconCopy, IconKey, IconLoader2, IconPlus } from "@tabler/icons-react";
import { useState } from "react";

import { revalidateRoute } from "@/app/(main)/dashboard/revalidate-homepage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { api } from "@/trpc/react";

const GenerateTokenTrigger = () => {
  const createAPIKeyMutation = api.token.create.useMutation();
  const [key, setKey] = useState<null | string>(null);
  const [copied, setCopied] = useState(false);

  const createKey = () => {
    createAPIKeyMutation
      .mutateAsync({
        name: "New API Key",
      })
      .then(async (results) => {
        setKey(results[0]!.token);
        trackEvent(POSTHOG_EVENTS.API_KEY_CREATED);
      })
      .catch(() => {
        return;
      });
  };

  const handlePageRevalidate = async () => {
    await revalidateRoute("/dashboard/settings");
  };

  const handleCopy = async () => {
    if (key) {
      await navigator.clipboard.writeText(key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div>
      {/* Empty State */}
      <div className="py-6 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 dark:bg-muted">
          <IconKey size={18} stroke={1.5} className="text-neutral-400 dark:text-neutral-500" />
        </div>
        <p className="text-[14px] font-medium text-neutral-900 dark:text-foreground">
          No API Key Yet
        </p>
        <p className="mx-auto mt-1 max-w-sm text-[12px] text-neutral-400 dark:text-neutral-500">
          Create an API key to programmatically access your links, analytics, and more.
        </p>
        <button
          type="button"
          onClick={createKey}
          disabled={createAPIKeyMutation.isLoading}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {createAPIKeyMutation.isLoading ? (
            <IconLoader2 size={14} stroke={1.5} className="animate-spin" />
          ) : (
            <IconPlus size={14} stroke={1.5} />
          )}
          Create API Key
        </button>
      </div>

      {/* Success Dialog */}
      <Dialog
        open={!!key}
        onOpenChange={async () => {
          setKey(null);
          await handlePageRevalidate();
        }}
      >
        <DialogContent className="max-w-md rounded-xl border-neutral-200 dark:border-border">
          <DialogHeader>
            <DialogTitle className="text-[14px] font-semibold text-neutral-900 dark:text-foreground">
              Your API key is ready
            </DialogTitle>
            <DialogDescription className="text-[12px] text-neutral-400 dark:text-neutral-500">
              Copy and save it somewhere safe. You won&apos;t be able to see it again.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {/* Key Display */}
            <div className="relative">
              <code className="block w-full break-all rounded-lg bg-neutral-900 px-3 py-3 pr-20 font-mono text-[12px] text-emerald-400">
                {key}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className={`absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                  copied
                    ? "bg-emerald-600 text-white"
                    : "bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
                }`}
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
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-500/10 p-3">
              <IconAlertTriangle size={15} stroke={1.5} className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-[12px] font-medium text-amber-800">
                  Store this key securely
                </p>
                <p className="mt-0.5 text-[11px] text-amber-700/80">
                  This key grants access to your account. Never share it or commit it to version control.
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GenerateTokenTrigger;
