// Pure rollups for the admin signups view (`getSignupAttribution`).

export const SIGNUP_CHANNELS = [
  "paid",
  "campaign",
  "organic",
  "referral",
  "direct",
  "unknown",
] as const;
export type SignupChannel = (typeof SIGNUP_CHANNELS)[number];

export const SIGNUP_DIMENSIONS = [
  "channel",
  "source",
  "medium",
  "campaign",
  "referrer",
  "landingPath",
] as const;
export type SignupDimension = (typeof SIGNUP_DIMENSIONS)[number];

/** One GROUP BY row: signups sharing the same first touch. */
export type SignupGroup = {
  // false when the signup has no UserAttribution row
  attributed: boolean;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrerHost: string | null;
  landingPath: string | null;
  hasClickId: boolean;
  signups: number;
  paid: number;
};

export type SignupBreakdownRow = { key: string; signups: number; paid: number };

const PAID_MEDIUMS = new Set([
  "cpc",
  "ppc",
  "cpm",
  "paid",
  "paidsearch",
  "paid_search",
  "paid-search",
  "paidsocial",
  "paid_social",
  "paid-social",
  "display",
  "ads",
]);

// Hostname labels of search engines; matched against any label so that
// www.google.com, google.co.uk and search.brave.com all count.
const SEARCH_ENGINES = new Set([
  "google",
  "bing",
  "duckduckgo",
  "yahoo",
  "yandex",
  "baidu",
  "ecosia",
  "brave",
  "startpage",
  "qwant",
  "naver",
]);

export const NOT_RECORDED = "(not recorded)";
export const NOT_SET = "(not set)";
export const DIRECT = "(direct)";

export function stripWww(host: string): string {
  return host.replace(/^www\./, "");
}

function isSearchEngine(host: string): boolean {
  return host.split(".").some((label) => SEARCH_ENGINES.has(label));
}

export function classifyChannel(group: SignupGroup): SignupChannel {
  if (!group.attributed) return "unknown";
  const medium = group.utmMedium?.toLowerCase() ?? null;
  if (group.hasClickId || (medium && PAID_MEDIUMS.has(medium))) return "paid";
  if (group.utmSource ?? group.utmMedium ?? group.utmCampaign) return "campaign";
  if (group.referrerHost) return isSearchEngine(group.referrerHost) ? "organic" : "referral";
  return "direct";
}

/** GA-style source/medium: UTMs win, otherwise derived from the referrer. */
function dimensionKey(group: SignupGroup, channel: SignupChannel, dim: SignupDimension): string {
  if (dim === "channel") return channel;
  if (!group.attributed) return NOT_RECORDED;
  const referrer = group.referrerHost ? stripWww(group.referrerHost) : null;
  switch (dim) {
    case "source":
      return group.utmSource ?? referrer ?? DIRECT;
    case "medium":
      if (group.utmMedium) return group.utmMedium;
      if (channel === "organic" || channel === "referral") return channel;
      return group.utmSource ? NOT_SET : "(none)";
    case "campaign":
      return group.utmCampaign ?? NOT_SET;
    case "referrer":
      return referrer ?? DIRECT;
    case "landingPath":
      return group.landingPath ?? NOT_SET;
  }
}

export function summarizeSignupGroups(groups: SignupGroup[], limit: number) {
  const maps = {
    channel: new Map<string, SignupBreakdownRow>(),
    source: new Map<string, SignupBreakdownRow>(),
    medium: new Map<string, SignupBreakdownRow>(),
    campaign: new Map<string, SignupBreakdownRow>(),
    referrer: new Map<string, SignupBreakdownRow>(),
    landingPath: new Map<string, SignupBreakdownRow>(),
  } satisfies Record<SignupDimension, Map<string, SignupBreakdownRow>>;
  const totals = { signups: 0, paid: 0, attributed: 0 };

  for (const group of groups) {
    totals.signups += group.signups;
    totals.paid += group.paid;
    if (group.attributed) totals.attributed += group.signups;
    const channel = classifyChannel(group);
    for (const dim of SIGNUP_DIMENSIONS) {
      const key = dimensionKey(group, channel, dim);
      const row = maps[dim].get(key) ?? { key, signups: 0, paid: 0 };
      row.signups += group.signups;
      row.paid += group.paid;
      maps[dim].set(key, row);
    }
  }

  const ranked = (dim: SignupDimension) =>
    [...maps[dim].values()]
      .sort((a, b) => b.signups - a.signups || b.paid - a.paid || a.key.localeCompare(b.key))
      .slice(0, limit);

  return {
    totals,
    breakdowns: {
      channel: ranked("channel"),
      source: ranked("source"),
      medium: ranked("medium"),
      campaign: ranked("campaign"),
      referrer: ranked("referrer"),
      landingPath: ranked("landingPath"),
    },
  };
}

export type SignupSeriesPoint = { date: string; signups: number; paid: number };

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Fills every UTC day from `since` to `until` (inclusive) and rolls the days up
 * into weeks starting Monday; a week is keyed by its first day in range.
 */
export function buildSignupSeries(
  rows: { date: string; signups: number; paid: number }[],
  since: Date,
  until: Date,
) {
  const byDay = new Map(rows.map((row) => [row.date, row]));
  const daily: SignupSeriesPoint[] = [];
  const weekly: SignupSeriesPoint[] = [];

  for (let t = since.getTime(); t <= until.getTime(); t += DAY_MS) {
    const day = new Date(t);
    const date = utcDay(day);
    const row = byDay.get(date);
    const point = { date, signups: row?.signups ?? 0, paid: row?.paid ?? 0 };
    daily.push(point);

    const week = weekly.at(-1);
    if (!week || day.getUTCDay() === 1) weekly.push({ ...point });
    else {
      week.signups += point.signups;
      week.paid += point.paid;
    }
  }

  return { daily, weekly };
}
