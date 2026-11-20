import type { LinkCreationStep } from "./failures";

const HOUR_MS = 60 * 60 * 1000;

export const FAILURE_WINDOW_MS = HOUR_MS;
export const SIGNUP_WINDOW_MS = 24 * HOUR_MS;
export const ALERT_DEBOUNCE_MS = 6 * HOUR_MS;

const FAILURE_RATE_THRESHOLD = 0.2;
const MIN_ATTEMPTS = 10;
const MIN_SIGNUPS = 5;

export type FailureCount = {
  step: LinkCreationStep;
  code: string;
  serverError: boolean;
  lastHour: number;
  lastDay: number;
};

export type LinkCreationHealthStats = {
  now: Date;
  /** Links created through any path in the last hour (the successful attempts). */
  linksCreatedLastHour: number;
  failures: FailureCount[];
  signupsLastDay: number;
  signupsWithLinks: number;
};

export type LinkCreationAlertKind = "failure-rate" | "signups-without-links";

export type LinkCreationAlert = {
  kind: LinkCreationAlertKind;
  title: string;
  windowStart: Date;
  windowEnd: Date;
  counts: Array<{ label: string; value: number }>;
  topErrorCode: string | null;
};

/**
 * Most frequent failure in the window as `step:CODE`, preferring server-side
 * failures since those are the ones an alert is about.
 */
export function topErrorCode(failures: FailureCount[], window: "lastHour" | "lastDay") {
  const seen = failures.filter((f) => f[window] > 0);
  const server = seen.filter((f) => f.serverError);
  const pool = server.length > 0 ? server : seen;
  const top = pool.reduce<FailureCount | null>(
    (best, f) => (best === null || f[window] > best[window] ? f : best),
    null,
  );
  return top ? `${top.step}:${top.code}` : null;
}

export function evaluateLinkCreationAlerts(stats: LinkCreationHealthStats): LinkCreationAlert[] {
  const alerts: LinkCreationAlert[] = [];
  const { now } = stats;

  const failedLastHour = stats.failures.reduce((sum, f) => sum + f.lastHour, 0);
  const serverFailedLastHour = stats.failures.reduce(
    (sum, f) => sum + (f.serverError ? f.lastHour : 0),
    0,
  );
  const attempts = stats.linksCreatedLastHour + failedLastHour;
  if (attempts >= MIN_ATTEMPTS && serverFailedLastHour / attempts > FAILURE_RATE_THRESHOLD) {
    alerts.push({
      kind: "failure-rate",
      title: "Link creation is failing",
      windowStart: new Date(now.getTime() - FAILURE_WINDOW_MS),
      windowEnd: now,
      counts: [
        { label: "Attempts", value: attempts },
        { label: "Server-side failures", value: serverFailedLastHour },
        { label: "All failures", value: failedLastHour },
      ],
      topErrorCode: topErrorCode(stats.failures, "lastHour"),
    });
  }

  if (stats.signupsLastDay >= MIN_SIGNUPS && stats.signupsWithLinks === 0) {
    alerts.push({
      kind: "signups-without-links",
      title: "New accounts are not creating links",
      windowStart: new Date(now.getTime() - SIGNUP_WINDOW_MS),
      windowEnd: now,
      counts: [
        { label: "Signups", value: stats.signupsLastDay },
        { label: "Signups with a link", value: stats.signupsWithLinks },
        {
          label: "Failed link creations",
          value: stats.failures.reduce((sum, f) => sum + f.lastDay, 0),
        },
      ],
      topErrorCode: topErrorCode(stats.failures, "lastDay"),
    });
  }

  return alerts;
}

/** One alert per condition per debounce window. */
export function isAlertDebounced(lastSentAt: Date | null, now: Date): boolean {
  return lastSentAt !== null && now.getTime() - lastSentAt.getTime() < ALERT_DEBOUNCE_MS;
}
