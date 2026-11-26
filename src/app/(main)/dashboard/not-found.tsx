import { IconFileOff } from "@tabler/icons-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

// Catches notFound() from dashboard pages (a missing folder, campaign, …) so
// signed-in users don't get the visitor-facing short-link 404 at the root.
export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-100 dark:bg-muted">
        <IconFileOff
          size={24}
          stroke={1.5}
          className="text-neutral-400 dark:text-muted-foreground"
        />
      </div>
      <p className="mt-6 text-[14px] font-medium text-neutral-900 dark:text-foreground">
        Page not found
      </p>
      <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-neutral-400 dark:text-muted-foreground">
        It may have been deleted, or it belongs to a different workspace.
      </p>
      <Button
        asChild
        className="mt-6 rounded-lg bg-blue-600 text-[13px] text-white hover:bg-blue-700"
      >
        <Link href="/dashboard">Back to links</Link>
      </Button>
    </div>
  );
}
