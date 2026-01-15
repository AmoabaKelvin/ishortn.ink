import crypto from "node:crypto";
import { waitUntil } from "@vercel/functions";
import { sql } from "drizzle-orm";
import { UAParser } from "ua-parser-js";

import { type Link, getFromCache, setInCache } from "@/lib/core/cache";
import { getContinentName, getCountryFullName } from "@/lib/countries";
import { isBot } from "@/lib/utils/is-bot";
import { db } from "@/server/db";
import { linkVisit, uniqueLinkVisit } from "@/server/db/schema";
import { registerEventUsage } from "@/server/lib/event-usage";
import { sendEventUsageEmail } from "@/server/lib/notifications/event-usage";

// Check if running on localhost (waitUntil doesn't work locally)
const isLocalhost = process.env.NODE_ENV === "development";

// Helper to run background tasks - awaits on localhost, uses waitUntil in production
async function runBackgroundTask<T>(promise: Promise<T>): Promise<T | undefined> {
  if (isLocalhost) {
    return promise;
  }
  waitUntil(promise);
  return undefined;
}

/**
 * This function records a unique click for a link.
 * It checks if there exists a unique click for this ip and link id.
 * If there is, it does not record the click.
 * If there is not, it records the click.
 */
async function recordUniqueClick(ipHash: string, linkId: number) {
  // CHECK IF THERE EXISTS A UNIQUE CLICK FOR THIS IP AND LINK ID
  const existingUniqueClick = await db.query.uniqueLinkVisit.findFirst({
    where: (table, { and, eq }) => and(eq(table.ipHash, ipHash), eq(table.linkId, linkId)),
  });

  if (existingUniqueClick) {
    return;
  }

  // RECORD THE UNIQUE CLICK
  await db.insert(uniqueLinkVisit).values({
    ipHash,
    linkId,
  });
}

async function recordClick(
  req: Request,
  link: Link,
  from: string,
  ip: string,
  country: string,
  city: string,
  continent: string,
  matchedGeoRuleId?: number
) {
  if (link.passwordHash) return;
  if (from === "metadata") return;

  const headers = new Headers(req.headers);
  const userAgent = headers.get("user-agent") ?? "";
  if (userAgent && isBot(userAgent)) return;

  const parsedUserAgent = new UAParser(userAgent).getResult();

  const deviceTypesMapping: Record<string, string> = {
    iOS: "Mobile",
    Android: "Mobile",
    "Mac OS": "Desktop",
    Windows: "Desktop",
  };

  const deviceDetails = {
    browser: parsedUserAgent.browser.name ?? "Unknown",
    os: parsedUserAgent.os.name ?? "Unknown",
    device:
      parsedUserAgent.device.type ?? deviceTypesMapping[parsedUserAgent.os.name ?? ""] ?? "Unknown",
    model: parsedUserAgent.device.model ?? "Unknown",
  };

  // On localhost, IP may be undefined - use a dummy value for hashing
  const ipForHash = ip && ip !== "undefined" ? ip : "localhost-dev";
  const ipHash = crypto.createHash("sha256").update(ipForHash).digest("hex");

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

  if (!usage.allowed) {
    return;
  }

  // On localhost, geolocation returns undefined - use dummy values
  let countryName: string;
  let continentName: string;
  let cityName: string;

  if (isLocalhost || !country || country === "undefined") {
    // Use realistic dummy data for localhost
    countryName = "United States";
    continentName = "North America";
    cityName = "San Francisco";
  } else {
    try {
      countryName = getCountryFullName(country) ?? "Unknown";
      continentName = getContinentName(country) ?? "Unknown";
      cityName = city ?? "Unknown";
    } catch {
      // Invalid country code, use fallback
      countryName = "United States";
      continentName = "North America";
      cityName = "San Francisco";
    }
  }

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
}

export async function recordUserClickForLink(
  req: Request,
  domain: string,
  alias: string,
  ip: string,
  country: string,
  city: string,
  continent: string,
  skipAnalytics = false,
) {
  const cleanedDomain = domain.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const cacheKey = `${domain.includes("localhost") ? "ishortn.ink" : cleanedDomain}:${alias}`;
  const cachedLink: Link | null = await getFromCache(cacheKey);

  if (cachedLink) {
    if (!skipAnalytics) {
      await recordClick(req, cachedLink, req.referrer ?? "direct", ip, country, city, continent);
    }
    return cachedLink;
  }

  const link = await db.query.link.findFirst({
    where: (table, { and, eq }) =>
      and(
        eq(table.domain, domain.includes("localhost") ? "ishortn.ink" : cleanedDomain),
        sql`lower(${table.alias}) = lower(${alias.replace("/", "")})`,
      ),
  });

  if (!link) {
    return null;
  }

  // await setInCache(cacheKey, link);

  // await recordClick(
  //   req,
  //   link,
  //   req.referrer ?? "direct",
  //   ip,
  //   country,
  //   city,
  //   continent
  // );

  await runBackgroundTask(setInCache(cacheKey, link));
  if (!skipAnalytics) {
    await runBackgroundTask(
      recordClick(req, link, req.referrer ?? "direct", ip, country, city, continent),
    );
  }
  return link;
}

export function parseReferrer(referrer: string | null): string {
  if (!referrer) return "direct";

  try {
    const url = new URL(referrer);
    const hostname = url.hostname.replace(/^www\./, "");

    // Handle common cases
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

    // For other cases, return up to two parts of the hostname
    const parts = hostname.split(".");
    return parts.slice(-2).join(".");
  } catch (_error) {
    return referrer.substring(0, 50);
  }
}

/**
 * Records a click with a matched geo rule ID for analytics.
 * This is used when a geo rule matches and we want to track which rule was applied.
 */
export async function recordUserClickWithGeoRule(
  req: Request,
  domain: string,
  alias: string,
  ip: string,
  country: string,
  city: string,
  continent: string,
  matchedGeoRuleId: number
) {
  const cleanedDomain = domain
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "");
  const cacheKey = `${
    domain.includes("localhost") ? "ishortn.ink" : cleanedDomain
  }:${alias}`;
  const cachedLink: Link | null = await getFromCache(cacheKey);

  if (cachedLink) {
    await recordClick(
      req,
      cachedLink,
      req.referrer ?? "direct",
      ip,
      country,
      city,
      continent,
      matchedGeoRuleId
    );
    return cachedLink;
  }

  // If not in cache, the link should have been fetched already by recordUserClickForLink
  // This shouldn't normally happen, but handle it gracefully
  const link = await db.query.link.findFirst({
    where: (table, { and, eq }) =>
      and(
        eq(
          table.domain,
          domain.includes("localhost") ? "ishortn.ink" : cleanedDomain
        ),
        sql`lower(${table.alias}) = lower(${alias.replace("/", "")})`
      ),
  });

  if (!link) {
    return null;
  }

  waitUntil(setInCache(cacheKey, link));
  waitUntil(
    recordClick(
      req,
      link,
      req.referrer ?? "direct",
      ip,
      country,
      city,
      continent,
      matchedGeoRuleId
    )
  );
  return link;
}
