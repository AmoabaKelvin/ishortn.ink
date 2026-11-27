import type { CheckResult } from "./check";

/** Consecutive failed daily checks before a link counts as broken. */
export const BROKEN_AFTER_FAILURES = 2;

export type LinkHealthState = {
  lastCheckedAt: Date;
  lastStatus: number | null;
  lastError: string | null;
  consecutiveFailures: number;
  brokenSince: Date | null;
  alertedAt: Date | null;
};

/**
 * The link's health after one check. A failure extends the streak and marks the link broken at
 * the second in a row; a success clears everything, including `alertedAt`, so the next outage
 * alerts again; an inconclusive check only moves `lastCheckedAt`.
 */
export function nextLinkHealth(
  previous: LinkHealthState | null,
  result: CheckResult,
  now: Date,
): LinkHealthState {
  const base = previous ?? {
    lastStatus: null,
    lastError: null,
    consecutiveFailures: 0,
    brokenSince: null,
    alertedAt: null,
  };

  if (result.kind === "inconclusive") return { ...base, lastCheckedAt: now };

  if (result.kind === "ok") {
    return {
      lastCheckedAt: now,
      lastStatus: result.status,
      lastError: null,
      consecutiveFailures: 0,
      brokenSince: null,
      alertedAt: null,
    };
  }

  const consecutiveFailures = base.consecutiveFailures + 1;
  return {
    lastCheckedAt: now,
    lastStatus: result.status,
    lastError: result.error,
    consecutiveFailures,
    brokenSince: base.brokenSince ?? (consecutiveFailures >= BROKEN_AFTER_FAILURES ? now : null),
    alertedAt: base.alertedAt,
  };
}

/** Whether the owner still needs telling about this link: broken, and not alerted this outage. */
export function needsAlert(state: Pick<LinkHealthState, "brokenSince" | "alertedAt">): boolean {
  return state.brokenSince !== null && state.alertedAt === null;
}

/**
 * Splits checks into lanes so no destination host gets more than `perHost` requests at once:
 * each host's URLs are dealt round-robin into at most `perHost` lanes, and each lane is run one
 * URL at a time.
 */
export function hostLanes<T extends { url: string }>(items: T[], perHost: number): T[][] {
  const byHost = new Map<string, { lanes: T[][]; count: number }>();
  for (const item of items) {
    let host: string;
    try {
      host = new URL(item.url).hostname.toLowerCase();
    } catch {
      host = item.url;
    }
    let entry = byHost.get(host);
    if (!entry) {
      entry = { lanes: [], count: 0 };
      byHost.set(host, entry);
    }
    (entry.lanes[entry.count++ % perHost] ??= []).push(item);
  }
  return [...byHost.values()].flatMap((entry) => entry.lanes);
}
