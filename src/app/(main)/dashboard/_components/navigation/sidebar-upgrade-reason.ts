import type { RouterOutputs } from "@/trpc/shared";

export type SidebarUpgradeSignals = NonNullable<RouterOutputs["subscriptions"]["upgradeSignals"]>;

type Usage = { count: number; limit: number | null };

export type SidebarUpgradeReason = {
  /** Analytics source; one per variant so impressions and clicks pair by reason. */
  source: string;
  label: string;
  hiddenClicks?: number;
};

export const EVENTS_PAUSED_SOURCE = "sidebar_events_paused";

/** Share of the monthly tracked-click cap from which the sidebar leads with it. */
const VISITS_REASON_SHARE = 0.6;

const formatCount = (value: number) => value.toLocaleString("en-US");

/** The visits reason, which needs only the usage summary; the sidebar skips the signal query when it applies. */
export function visitsUpgradeReason(
  events: (Usage & { paused?: unknown }) | undefined,
): SidebarUpgradeReason | null {
  if (!events || events.limit == null || events.count < events.limit * VISITS_REASON_SHARE) {
    return null;
  }
  const used = Math.min(events.count, events.limit);
  return {
    source: events.paused ? EVENTS_PAUSED_SOURCE : "sidebar_visits_cap",
    label: `${formatCount(used)}/${formatCount(events.limit)} tracked clicks used`,
  };
}

/**
 * The strongest reason a Free account has to upgrade, in priority order, falling back to the
 * generic button. `signals` is null while it streams in (or failed), which skips the reasons
 * that need it.
 */
export function sidebarUpgradeReason({
  events,
  qrCodes,
  linksAtLimit,
  signals,
}: {
  events?: Usage & { paused?: unknown };
  qrCodes?: Usage;
  linksAtLimit: boolean;
  signals: SidebarUpgradeSignals | null;
}): SidebarUpgradeReason {
  const visits = visitsUpgradeReason(events);
  if (visits) return visits;

  if (signals && signals.hiddenClicks > 0) {
    const { hiddenClicks } = signals;
    return {
      source: "sidebar_hidden_clicks",
      label: `${formatCount(hiddenClicks)} older ${hiddenClicks === 1 ? "click" : "clicks"} hidden`,
      hiddenClicks,
    };
  }

  if (qrCodes && qrCodes.limit != null && qrCodes.count >= qrCodes.limit) {
    return {
      source: "sidebar_qr_cap",
      label: `${formatCount(qrCodes.count)}/${formatCount(qrCodes.limit)} QR codes used`,
    };
  }

  if (signals?.workDomain) {
    return { source: "sidebar_domain", label: `Use links.${signals.workDomain}` };
  }

  return {
    source: linksAtLimit ? "sidebar_free_at_limit" : "sidebar_free",
    label: "Upgrade to Pro",
  };
}
