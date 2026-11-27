"use client";

import { IconAlertTriangle, IconCheck, IconCopy } from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

/** The signing secret, shown once after creating or rolling it. */
export function WebhookSecret({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the secret. Select it and copy it manually.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <code className="block w-full break-all rounded-lg bg-neutral-900 px-3 py-3 pr-20 font-mono text-[12px] text-emerald-400">
          {secret}
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

      <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-500/10">
        <IconAlertTriangle
          size={15}
          stroke={1.5}
          className="mt-0.5 flex-shrink-0 text-amber-700 dark:text-amber-400"
        />
        <div>
          <p className="text-[12px] font-medium text-amber-700 dark:text-amber-400">
            You won&apos;t see this secret again
          </p>
          <p className="mt-0.5 text-[11px] text-amber-700/80 dark:text-amber-400/80">
            Use it to verify the X-iShortn-Signature header on every request. Roll it from the
            endpoint&apos;s menu if it leaks.
          </p>
        </div>
      </div>
    </div>
  );
}
