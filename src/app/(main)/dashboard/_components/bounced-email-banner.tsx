"use client";

import { useClerk } from "@clerk/nextjs";
import { IconAlertTriangle } from "@tabler/icons-react";

export function BouncedEmailBanner() {
  const { openUserProfile } = useClerk();

  return (
    <div className="mt-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-700 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
      <IconAlertTriangle size={16} stroke={1.5} className="mt-0.5 shrink-0" />
      <p className="min-w-0">
        Emails to your address are bouncing, so you may miss sign-in, billing and account messages.{" "}
        <button
          type="button"
          onClick={() => openUserProfile()}
          className="font-medium underline underline-offset-2 hover:text-amber-800 dark:hover:text-amber-300"
        >
          Update your email
        </button>
      </p>
    </div>
  );
}
