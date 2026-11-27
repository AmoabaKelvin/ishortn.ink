"use client";

import { IconArrowUpRight, IconTag } from "@tabler/icons-react";
import { Suspense, use } from "react";

import { UpgradeCta } from "@/components/upgrade-cta";
import { planPriceDisplay } from "@/lib/billing/pricing";
import { formatPromoEndShort } from "@/lib/billing/promo";
import { cn } from "@/lib/utils";

import { eventsUpgradeTarget, formatResetDay } from "../tracking-paused";
import { useUpgradeOffer } from "../upgrade-offer";
import { EVENTS_PAUSED_SOURCE, sidebarUpgradeReason } from "./sidebar-upgrade-reason";

import type { SidebarUpgradeReason, SidebarUpgradeSignals } from "./sidebar-upgrade-reason";
import type { Promo } from "@/lib/billing/promo";

export type EventUsage = {
  count: number;
  limit: number | null;
  resetsAt?: Date;
  paused?: { dropped: number } | null;
};

function EventMeter({ eventUsage }: { eventUsage: EventUsage }) {
  const { count, limit, resetsAt, paused } = eventUsage;
  if (limit == null) return null;
  const percentage = Math.min((count / (limit || 1)) * 100, 100);
  const atLimit = count >= limit;
  const nearLimit = !atLimit && count >= limit * 0.8;

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
        <span>Events</span>
        <span className="tabular-nums">
          {count.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            atLimit ? "bg-red-500" : nearLimit ? "bg-amber-500" : "bg-blue-600",
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {atLimit && (
        <p className="mt-1.5 text-[11px] text-red-600 dark:text-red-400">
          Analytics paused until next reset.
          {paused && paused.dropped > 0 && (
            <>
              {" "}
              <span className="font-medium tabular-nums">
                {paused.dropped.toLocaleString()}
              </span>{" "}
              {paused.dropped === 1 ? "visit" : "visits"} not recorded.
            </>
          )}
        </p>
      )}
      {nearLimit && (
        <p className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-400">
          <span className="tabular-nums">
            {count.toLocaleString()} of {limit.toLocaleString()}
          </span>{" "}
          events used{resetsAt ? `, resets ${formatResetDay(resetsAt)}` : ""}.
        </p>
      )}
    </div>
  );
}

// Annual, because that is the interval the pricing page opens on for Free accounts.
function SidebarOffer({ promo }: { promo: Promo }) {
  const price = planPriceDisplay("pro", "annual", promo);
  return (
    <div className="px-1">
      <p className="flex items-center gap-1.5 text-[12px] font-medium text-neutral-900 dark:text-foreground">
        <IconTag
          size={14}
          stroke={1.5}
          aria-hidden="true"
          className="shrink-0 text-blue-600 dark:text-blue-400"
        />
        {promo.label}: {promo.percentOff}% off Pro
      </p>
      <p className="mt-0.5 text-[11px] leading-snug text-neutral-500 dark:text-neutral-400">
        ${price.perMonth}/mo for your first year, billed yearly. Ends{" "}
        {formatPromoEndShort(promo.endsAt)}.
      </p>
    </div>
  );
}

type FreeUpgradeButtonProps = {
  reason: SidebarUpgradeReason;
  shown: boolean;
  promo: Promo | null;
};

function FreeUpgradeButton({ reason, shown, promo }: FreeUpgradeButtonProps) {
  const isGeneric = reason.label === "Upgrade to Pro";
  return (
    <UpgradeCta
      requiredPlan="pro"
      source={reason.source}
      shown={shown}
      promo={promo}
      trackingProperties={reason.hiddenClicks ? { hidden_clicks: reason.hiddenClicks } : undefined}
      aria-label={isGeneric ? undefined : `${reason.label}. Upgrade to Pro`}
      title={isGeneric ? undefined : reason.label}
      className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-[12px] font-medium text-white transition-colors hover:bg-blue-700"
    >
      <span className="min-w-0 truncate tabular-nums">{reason.label}</span>
      <IconArrowUpRight size={13} stroke={2} className="shrink-0" />
    </UpgradeCta>
  );
}

type ReasonInputs = Omit<Parameters<typeof sidebarUpgradeReason>[0], "signals">;

function StreamedUpgradeButton({
  signals,
  inputs,
  ...props
}: Omit<FreeUpgradeButtonProps, "reason"> & {
  signals: Promise<SidebarUpgradeSignals | null>;
  inputs: ReasonInputs;
}) {
  const reason = sidebarUpgradeReason({ ...inputs, signals: use(signals) });
  return <FreeUpgradeButton reason={reason} {...props} />;
}

type SidebarStatsProps = {
  monthlyLinkCount: number;
  userHasPaidPlan: boolean;
  linkLimit: number | null;
  eventUsage?: EventUsage;
  folderUsage?: { count: number; limit: number | null };
  qrCodeUsage?: { count: number; limit: number | null };
  /** Streamed signals for the Free upgrade reason; null when the usage summary already decides it. */
  upgradeSignals?: Promise<SidebarUpgradeSignals | null> | null;
  plan: "free" | "pro" | "ultra";
  /** Whether the sidebar is on screen; on mobile it stays mounted off-canvas while closed. */
  shown: boolean;
};

export function SidebarStats({
  monthlyLinkCount,
  userHasPaidPlan,
  linkLimit,
  eventUsage,
  qrCodeUsage,
  upgradeSignals = null,
  plan,
  shown,
}: SidebarStatsProps) {
  const linkCap = linkLimit ?? undefined;
  const linkLimitValue = linkCap ?? (userHasPaidPlan ? undefined : 30);
  const percentage =
    linkLimitValue != null ? Math.min((monthlyLinkCount / (linkLimitValue || 1)) * 100, 100) : 0;
  const isNearLimit = linkLimitValue != null ? monthlyLinkCount >= linkLimitValue * 0.83 : false;
  const isAtLimit = linkLimitValue != null ? monthlyLinkCount >= linkLimitValue : false;
  // While tracking is paused the upgrade CTA leads with the event cap.
  const eventsTarget = eventUsage?.paused ? eventsUpgradeTarget(plan) : null;
  const promo = useUpgradeOffer();
  const reasonInputs: ReasonInputs = {
    events: eventUsage,
    qrCodes: qrCodeUsage,
    linksAtLimit: isAtLimit,
  };

  if (userHasPaidPlan) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-neutral-100 dark:border-border/50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-muted-foreground">
              {plan} plan
            </span>
            <span className="text-[11px] tabular-nums text-neutral-500 dark:text-neutral-400">
              {monthlyLinkCount} links this month
            </span>
          </div>

          {/* Event usage — only show if limit exists */}
          {eventUsage && <EventMeter eventUsage={eventUsage} />}
        </div>

        {plan === "pro" && (
          <UpgradeCta
            requiredPlan="ultra"
            source={eventsTarget ? EVENTS_PAUSED_SOURCE : "sidebar_pro"}
            shown={shown}
            className="flex items-center gap-1 px-1 text-[12px] font-medium text-neutral-400 dark:text-muted-foreground transition-colors hover:text-neutral-900 dark:hover:text-foreground"
          >
            Upgrade to Ultra
            <IconArrowUpRight size={12} stroke={1.5} />
          </UpgradeCta>
        )}
      </div>
    );
  }

  // Free plan
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-neutral-100 dark:border-border/50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-muted-foreground">
            Free plan
          </span>
          <span
            className={cn(
              "text-[11px] font-medium tabular-nums",
              isAtLimit
                ? "text-red-600 dark:text-red-400"
                : "text-neutral-500 dark:text-neutral-400",
            )}
          >
            {monthlyLinkCount} / {linkLimitValue} links
          </span>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isAtLimit ? "bg-red-500" : isNearLimit ? "bg-amber-500" : "bg-blue-600",
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {isAtLimit && (
          <p className="mt-2 text-[11px] text-red-600 dark:text-red-400">
            Limit reached. Upgrade for more links.
          </p>
        )}
        {isNearLimit && !isAtLimit && (
          <p className="mt-2 text-[11px] text-amber-600">Almost at limit. Consider upgrading.</p>
        )}

        {eventUsage && <EventMeter eventUsage={eventUsage} />}
      </div>

      <div className="space-y-2">
        {promo && <SidebarOffer promo={promo} />}
        {upgradeSignals ? (
          // Until the signals arrive, the generic button holds the space without an impression.
          <Suspense
            fallback={
              <FreeUpgradeButton
                reason={sidebarUpgradeReason({ linksAtLimit: isAtLimit, signals: null })}
                shown={false}
                promo={promo}
              />
            }
          >
            <StreamedUpgradeButton
              signals={upgradeSignals}
              inputs={reasonInputs}
              shown={shown}
              promo={promo}
            />
          </Suspense>
        ) : (
          <FreeUpgradeButton
            reason={sidebarUpgradeReason({ ...reasonInputs, signals: null })}
            shown={shown}
            promo={promo}
          />
        )}
      </div>
    </div>
  );
}
