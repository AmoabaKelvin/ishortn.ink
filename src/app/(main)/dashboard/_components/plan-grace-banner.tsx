"use client";

import { IconAlertTriangle } from "@tabler/icons-react";
import { Link } from "next-view-transitions";

import { trackUpgradeClick, useTrackUpgradeShown } from "@/lib/analytics/upgrade-prompt";
import { PLAN_NAMES, updatePaymentPath } from "@/lib/billing/entitlements";
import { api } from "@/trpc/react";

import type { RouterOutputs } from "@/trpc/shared";

type GraceNotice = RouterOutputs["subscriptions"]["entitlementNotice"];

const GRACE_SOURCE = "plan_grace_banner";

// Grace periods end at an instant stored in UTC; render the day in UTC so server
// and client output match.
const formatDay = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Plan grace-period and read-only-team notice shown above every dashboard page. */
export function PlanGraceBanner({ initialNotice }: { initialNotice?: GraceNotice }) {
  const { data: notice } = api.subscriptions.entitlementNotice.useQuery(undefined, {
    initialData: initialNotice,
    staleTime: 5 * 60 * 1000,
  });
  // Mirrors the branches below: the Upgrade link shows unless the notice asks for a payment
  // update, and on team notices only to the owner.
  const upgradeShown =
    !!notice && notice.action !== "update_payment" && (notice.type !== "team" || notice.isOwner);
  useTrackUpgradeShown(GRACE_SOURCE, upgradeShown);

  if (!notice) return null;

  let message: string;
  let showUpgrade = true;
  let updatePayment = false;
  if (notice.type === "team") {
    updatePayment = notice.action === "update_payment";
    const endsOn = notice.endsAt ? formatDay(notice.endsAt) : "next week";
    if (updatePayment) {
      message = notice.readOnly
        ? "Your last Ultra payment didn't go through. This workspace is read-only until the payment method is updated: existing links keep working, but nothing can be added or edited."
        : `Your last Ultra payment didn't go through. From ${endsOn}, this workspace becomes read-only unless the payment method is updated.`;
    } else {
      message = notice.readOnly
        ? "The workspace owner needs Ultra. This workspace is read-only: existing links keep working, but nothing can be added or edited."
        : `The workspace owner needs Ultra. From ${endsOn}, this workspace becomes read-only.`;
    }
    showUpgrade = notice.isOwner;
  } else {
    const plan = PLAN_NAMES[notice.plan];
    updatePayment = notice.action === "update_payment";
    message = updatePayment
      ? `Your last ${plan} payment didn't go through. Your ${plan} access ends on ${formatDay(notice.endsAt)} unless the payment method is updated.`
      : notice.reason === "lapsed"
        ? `Your ${plan} access ends on ${formatDay(notice.endsAt)}. After that, Free limits apply to new links and paid link settings.`
        : `Some features you use need ${plan}. From ${formatDay(notice.endsAt)} they can't be added or changed.`;
  }

  return (
    <div className="mb-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-700 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
      <IconAlertTriangle size={16} stroke={1.5} className="mt-0.5 shrink-0" />
      <p className="min-w-0">
        {message}
        {(updatePayment || showUpgrade) && (
          <>
            {" "}
            &middot;{" "}
            <Link
              href={updatePayment ? updatePaymentPath("banner") : "/dashboard/pricing"}
              // The payment page fetches a signed Lemon Squeezy URL; don't run it on prefetch.
              prefetch={updatePayment ? false : undefined}
              onClick={updatePayment ? undefined : () => trackUpgradeClick(GRACE_SOURCE)}
              className="font-medium underline underline-offset-2 hover:text-amber-800 dark:hover:text-amber-300"
            >
              {updatePayment ? "Update payment method" : "Upgrade"}
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
