"use client";

import { useRef } from "react";

import { cn } from "@/lib/utils";

import { CopyButton } from "./copy-button";

import type { ComponentProps } from "react";

export const codeSurfaceClass =
  "docs-code overflow-hidden rounded-xl bg-neutral-50 ring-1 ring-neutral-950/[0.07] dark:bg-white/[0.03] dark:ring-white/10";

/** Replaces MDX `pre`: Shiki-highlighted code with an optional title and a copy button. */
export function CodeBlock({ title, className, children, ...props }: ComponentProps<"pre">) {
  const preRef = useRef<HTMLPreElement>(null);
  const getText = () => preRef.current?.textContent ?? "";

  return (
    <div className={codeSurfaceClass}>
      {title ? (
        <div className="flex items-center justify-between gap-2 border-b border-neutral-950/[0.07] py-1 pl-4 pr-1 dark:border-white/10">
          <span className="truncate text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {title}
          </span>
          <CopyButton getText={getText} />
        </div>
      ) : null}
      <div className="relative">
        <pre ref={preRef} className={cn(className, !title && "pr-12")} {...props}>
          {children}
        </pre>
        {title ? null : (
          <CopyButton
            getText={getText}
            className="absolute right-1.5 top-1.5 bg-neutral-50 dark:bg-neutral-900"
          />
        )}
      </div>
    </div>
  );
}
