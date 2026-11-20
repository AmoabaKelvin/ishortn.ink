"use client";

import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

export function CopyButton({ getText, className }: { getText: () => string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied (insecure context, permissions); the
      // code stays selectable, so there is nothing else to do.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : "Copy code"}
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-950/5 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white",
        className,
      )}
    >
      {copied ? (
        <IconCheck aria-hidden="true" className="size-4" />
      ) : (
        <IconCopy aria-hidden="true" className="size-4" />
      )}
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </button>
  );
}
