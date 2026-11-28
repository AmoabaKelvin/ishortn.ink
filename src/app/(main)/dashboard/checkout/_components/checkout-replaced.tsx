import { IconRefresh } from "@tabler/icons-react";
import { Link } from "next-view-transitions";

import { Button } from "@/components/ui/button";

/** Shown instead of a checkout whose transaction was canceled because a newer one replaced it. */
export function CheckoutReplacedState() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-100 dark:bg-muted">
        <IconRefresh
          size={24}
          stroke={1.5}
          className="text-neutral-400 dark:text-muted-foreground"
        />
      </div>
      <p className="mt-6 text-[14px] font-medium text-neutral-900 dark:text-foreground">
        This checkout was replaced
      </p>
      <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400">
        This checkout was replaced by a newer one. Start again from the pricing page. You
        haven&apos;t been charged.
      </p>
      <Button
        asChild
        className="mt-6 rounded-lg bg-blue-600 text-[13px] text-white hover:bg-blue-700"
      >
        <Link href="/dashboard/pricing">Back to pricing</Link>
      </Button>
    </div>
  );
}
