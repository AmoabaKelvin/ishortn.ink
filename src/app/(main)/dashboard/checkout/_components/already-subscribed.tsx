import { IconCreditCard } from "@tabler/icons-react";
import { Link } from "next-view-transitions";

import { Button } from "@/components/ui/button";

/** Shown instead of a new-subscription checkout when the user already has a subscription. */
export function AlreadySubscribedState() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-100 dark:bg-muted">
        <IconCreditCard
          size={24}
          stroke={1.5}
          className="text-neutral-400 dark:text-muted-foreground"
        />
      </div>
      <p className="mt-6 text-[14px] font-medium text-neutral-900 dark:text-foreground">
        You already have a subscription
      </p>
      <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400">
        This checkout would start a second subscription, so it won&apos;t open. You haven&apos;t
        been charged. Change your plan from billing settings.
      </p>
      <Button
        asChild
        className="mt-6 rounded-lg bg-blue-600 text-[13px] text-white hover:bg-blue-700"
      >
        <Link href="/dashboard/settings#billing">Billing settings</Link>
      </Button>
    </div>
  );
}
