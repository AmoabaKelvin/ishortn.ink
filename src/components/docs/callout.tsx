import { IconAlertTriangleFilled, IconInfoCircleFilled } from "@tabler/icons-react";

import type { ReactNode } from "react";

/** A note or warning box inside docs content. */
export function Callout({
  type = "note",
  children,
}: {
  type?: "note" | "warning";
  children: ReactNode;
}) {
  const Icon = type === "warning" ? IconAlertTriangleFilled : IconInfoCircleFilled;
  return (
    <div className="flex gap-3 rounded-xl bg-neutral-950/[0.04] p-4 dark:bg-white/[0.06]">
      <Icon aria-hidden="true" className="mt-1 size-4 shrink-0 text-neutral-500 dark:text-neutral-400" />
      <div className="min-w-0 space-y-2">
        <span className="sr-only">{type === "warning" ? "Warning: " : "Note: "}</span>
        {children}
      </div>
    </div>
  );
}
