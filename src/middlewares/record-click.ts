import { sql } from "drizzle-orm";
import { UAParser } from "ua-parser-js";

import { type Link, buildCacheKey, normalizeDomain, getFromCache, setInCache } from "@/lib/core/cache";
import { getContinentName, getCountryFullName } from "@/lib/countries";
import { runBackgroundTask } from "@/lib/utils/background";
import { hashIp } from "@/lib/utils/ip-hash";
import { isBot } from "@/lib/utils/is-bot";
import { db } from "@/server/db";
import { linkVisit, uniqueLinkVisit } from "@/server/db/schema";
import { registerEventUsage } from "@/server/lib/event-usage";
import { checkAndFireMilestones } from "@/server/lib/milestone-check";
import { sendEventUsageEmail } from "@/server/lib/notifications/event-usage";

const isLocalhost = process.env.NODE_ENV === "development";

const OS_TO_DEVICE_TYPE: Record<string, string> = {
  iOS: "Mobile",
  Android: "Mobile",
  "Mac OS": "Desktop",
  Windows: "Desktop",
  Linux: "Desktop",
  Ubuntu: "Desktop",
  Debian: "Desktop",
  Fedora: "Desktop",
  "Chrome OS": "Desktop",
  ChromeOS: "Desktop",
  FreeBSD: "Desktop",
  OpenBSD: "Desktop",
};

/**
 * Cache-first link lookup. No side effects except populating the cache on miss.
 * Returns null when the alias/domain pair doesn't resolve.
 */
export async function resolveLink(domain: string, alias: string): Promise<Link | null> {
  const cacheKey = buildCacheKey(domain, alias);
  const cached: Link | null = await getFromCache(cacheKey);
  if (cached) return cached;

  const link = await db.query.link.findFirst({
    where: (table, { and, eq }) =>
      and(
        eq(table.domain, normalizeDomain(domain)),
        sql`lower(${table.alias}) = lower(${alias.replace("/", "")})`,
      ),
  });
  if (!link) return null;

  await runBackgroundTask(setInCache(cacheKey, link));
  return link;
}

/**
 * Records a unique click. Relies on the UNIQUE(linkId, ipHash) index so
 * concurrent inserts silently collapse to a no-op.
 */
async function recordUniqueClick(ipHash: string, linkId: number) {
  await db
    .insert(uniqueLinkVisit)
    .values({ ipHash, linkId })
    .onDuplicateKeyUpdate({ set: { linkId: sql`linkId` } });
}

function resolveGeo(country: string, city: string) {
  if (isLocalhost) {
    return {
      countryName: "United States",
      continentName: "North America",
      cityName: "San Francisco",
    };
  }

  if (!country || country === "undefined" || country === "Unknown") {
    return { countryName: "Unknown", continentName: "Unknown", cityName: "Unknown" };
  }

  try {
    return {
      countryName: getCountryFullName(country) ?? "Unknown",
      continentName: getContinentName(country) ?? "Unknown",
      cityName: city && city !== "undefined" && city !== "Unknown" ? city : "Unknown",
    };
  } catch {
    return { countryName: "Unknown", continentName: "Unknown", cityName: "Unknown" };
  }
}

/**
 * Records a click for an already-resolved link. Callers are responsible for
 * deciding whether to record (e.g. skip for password-protected redirects that
 * haven't been unlocked yet) — this function records unconditionally aside from
 * bot filtering and quota enforcement.
 */
export async function recordClick(
  headers: Headers,
  link: Link,
  ip: string,
  country: string,
  city: string,
  matchedGeoRuleId?: number,
): Promise<void> {
  const userAgent = headers.get("user-agent") ?? "";
  if (userAgent && isBot(userAgent)) return;

  const parsedUserAgent = await UAParser(userAgent, headers).withClientHints();

  const osName = parsedUserAgent.os.name ?? "Unknown";
  const deviceDetails = {
    browser: parsedUserAgent.browser.name ?? "Unknown",
    os: osName,
    device: parsedUserAgent.device.type ?? OS_TO_DEVICE_TYPE[osName] ?? "Unknown",
    model: parsedUserAgent.device.model ?? "Unknown",
  };

  const ipForHash = ip && ip !== "undefined" ? ip : "localhost-dev";
  const ipHash = hashIp(ipForHash);

  const usage = await registerEventUsage(link.userId, db);

  if (usage.alertLevelTriggered && usage.limit && usage.userEmail && usage.plan) {
    await runBackgroundTask(
      sendEventUsageEmail({
        email: usage.userEmail,
        name: usage.userName,
        threshold: usage.alertLevelTriggered,
        limit: usage.limit,
        currentCount: usage.currentCount,
        plan: usage.plan,
      }),
    );
  }

  if (!usage.allowed) return;

  const { countryName, continentName, cityName } = resolveGeo(country, city);

  await Promise.all([
    db.insert(linkVisit).values({
      linkId: link.id,
      ...deviceDetails,
      referer: parseReferrer(headers.get("referer")),
      country: countryName,
      city: cityName,
      continent: continentName,
      matchedGeoRuleId: matchedGeoRuleId ?? null,
    }),
    recordUniqueClick(ipHash, link.id),
  ]);

  void runBackgroundTask(checkAndFireMilestones(link.id, link.userId));
}

export function parseReferrer(referrer: string | null): string {
  if (!referrer) return "direct";

  try {
    const url = new URL(referrer);
    const hostname = url.hostname.replace(/^www\./, "");

    const referrerMap: Record<string, string> = {
      "t.co": "twitter",
      "l.facebook.com": "facebook",
      "lm.facebook.com": "facebook",
      "m.facebook.com": "facebook",
      "linkedin.com": "linkedin",
      "lnkd.in": "linkedin",
      "out.reddit.com": "reddit",
      "away.vk.com": "vkontakte",
      "com.google.android.gm": "gmail",
    };

    if (hostname in referrerMap) {
      return referrerMap[hostname] ?? hostname;
    }

    const parts = hostname.split(".");
    return parts.slice(-2).join(".");
  } catch {
    return "unknown";
  }
}
