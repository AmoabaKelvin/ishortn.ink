"use client";

import { IconAlertTriangle, IconLoader2 } from "@tabler/icons-react";
import { Link } from "next-view-transitions";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { trackUpgradeClick, useTrackUpgradeShown } from "@/lib/analytics/upgrade-prompt";
import { PLAN_NAMES, updatePaymentPath } from "@/lib/billing/entitlements";
import { promoOfferLine } from "@/lib/billing/promo";
import { api } from "@/trpc/react";

import type { BillingInterval } from "@/lib/billing/plans";
import type { Promo } from "@/lib/billing/promo";
import type { RouterOutputs } from "@/trpc/shared";

type GraceNotice = RouterOutputs["subscriptions"]["entitlementNotice"];

const GRACE_SOURCE = "plan_grace_banner";

// Grace periods end at an instant stored in UTC; render the day in UTC so server
// and client output match.
const formatDay = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/**
 * Plan grace-period and read-only-team notice shown above every dashboard page. With a `promo`
 * (`graceOfferPromo`: a lapsed or over-plan account that would start a new checkout) it adds the
 * offer, its code and a button that opens the checkout with the code applied.
 */
export function PlanGraceBanner({
  initialNotice,
  promo,
  interval,
}: {
  initialNotice?: GraceNotice;
  promo?: Promo | null;
  /** Billing interval of the lapsed subscription, reused for the resubscribe checkout. */
  interval: BillingInterval;
}) {
  const { data: notice } = api.subscriptions.entitlementNotice.useQuery(undefined, {
    initialData: initialNotice,
    staleTime: 5 * 60 * 1000,
  });
  const resubscribe = api.lemonsqueezy.createCheckoutOrUpdate.useMutation({
    onSuccess: (data) => {
      if (data.status === "redirect") window.location.assign(data.url);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  // Re-checked against the live notice: a refetch can turn the lapse into a failed payment.
  const offerPlan =
    promo && notice?.type === "account" && notice.action === "upgrade" && notice.plan !== "free"
      ? notice.plan
      : null;
  // A lapsed account had this plan; an over-plan one may never have paid for it.
  const offerVerb =
    notice?.type === "account" && notice.reason === "lapsed" ? "Resubscribe" : "Upgrade";
  useTrackUpgradeShown(GRACE_SOURCE, !!offerPlan, promo ? { promo: promo.code } : undefined);
  // Mirrors the branches below: the Upgrade link shows unless the notice asks for a payment
  // update, and on team notices only to the owner.
  const upgradeShown =
    !!notice && notice.action !== "update_payment" && (notice.type !== "team" || notice.isOwner);
  useTrackUpgradeShown(GRACE_SOURCE, upgradeShown && !offerPlan);

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

  // The checkout button replaces the Upgrade link: pricing shows a lapsed grace plan as current.
  if (offerPlan) showUpgrade = false;
  // Stays busy after success until the checkout page loads.
  const isOpening = resubscribe.isLoading || resubscribe.isSuccess;

  return (
    <div className="mb-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-700 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
      <IconAlertTriangle size={16} stroke={1.5} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
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
        {offerPlan && promo && (
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <p className="min-w-0">
              <span className="font-medium">{promoOfferLine(promo, PLAN_NAMES[offerPlan])}</span>{" "}
              Code <span className="font-semibold">{promo.code}</span>, applied at checkout.
            </p>
            <Button
              size="sm"
              className="h-8 shrink-0 bg-blue-600 text-[12px] text-white hover:bg-blue-700"
              disabled={isOpening}
              onClick={() => {
                trackUpgradeClick(GRACE_SOURCE, { promo: promo.code });
                resubscribe.mutate({
                  plan: offerPlan,
                  interval,
                  source: GRACE_SOURCE,
                  utm: { utm_source: "app", utm_medium: "banner", utm_campaign: promo.utmCampaign },
                });
              }}
            >
              {isOpening && <IconLoader2 size={14} stroke={2} className="mr-1.5 animate-spin" />}
              {isOpening ? "Opening checkout..." : `${offerVerb} to ${PLAN_NAMES[offerPlan]}`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
