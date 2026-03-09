import { asc, count, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

import {
  type Link,
  buildCacheKey,
  deleteFromCache,
  getGeoRulesFromCache,
  setGeoRulesInCache,
} from "@/lib/core/cache";
import { matchGeoRules } from "@/lib/core/geo-rules/matcher";
import {
  recordUserClickForLink,
  recordUserClickWithGeoRule,
} from "@/middlewares/record-click";
import { db } from "@/server/db";
import { geoRule, link as linkTable, linkVisit } from "@/server/db/schema";

/** Fire-and-forget: mark a link as disabled in the DB and purge its cache entry. */
function autoDisableLink(linkId: number, cacheKey: string): void {
  void db
    .update(linkTable)
    .set({ disabled: true })
    .where(eq(linkTable.id, linkId))
    .then(() => deleteFromCache(cacheKey))
    .catch((err) => console.error("Failed to auto-disable link:", err));
}

/**
 * Check if a link has expired by date, click threshold, or manual disable.
 * When a threshold is crossed, auto-disables the link in the DB and invalidates the cache.
 */
async function checkLinkExpiration(
  link: Link,
  cacheKey: string,
): Promise<boolean> {
  if (link.disabled) {
    return true;
  }

  // Date-based expiration
  if (link.disableLinkAfterDate && new Date() >= link.disableLinkAfterDate) {
    autoDisableLink(link.id, cacheKey);
    return true;
  }

  // Click-based expiration
  if (link.disableLinkAfterClicks) {
    const result = await db
      .select({ clickCount: count(linkVisit.id) })
      .from(linkVisit)
      .where(eq(linkVisit.linkId, link.id));

    const clickCount = result[0]?.clickCount ?? 0;

    if (clickCount >= link.disableLinkAfterClicks) {
      autoDisableLink(link.id, cacheKey);
      return true;
    }
  }

  return false;
}

type UtmParams = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
} | null;

function appendUtmParams(baseUrl: string, utmParams: UtmParams): string {
  if (!utmParams) return baseUrl;

  try {
    const url = new URL(baseUrl);
    const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

    for (const key of keys) {
      const value = utmParams[key];
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value); // .set() overrides existing params
      }
    }

    return url.toString();
  } catch {
    // If URL parsing fails, return original URL
    return baseUrl;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const domain = searchParams.get("domain");
  const alias = searchParams.get("alias")?.replace("/", "");
  const ip = searchParams.get("ip") ?? "";

  // Normalize geo params - treat "undefined", "null", empty strings as Unknown
  const rawCountry = searchParams.get("country");
  const rawCity = searchParams.get("city");
  const rawContinent = searchParams.get("continent");

  const country = rawCountry && rawCountry !== "undefined" && rawCountry !== "null" ? rawCountry : "Unknown";
  const city = rawCity && rawCity !== "undefined" && rawCity !== "null" ? rawCity : "Unknown";
  const continent = rawContinent && rawContinent !== "undefined" && rawContinent !== "null" ? rawContinent : "Unknown";

  console.log(
    `Processing link for domain: ${domain}, alias: ${alias}, country: ${country}, city: ${city}, continent: ${continent}, ip: ${ip}`,
  );

  if (!domain || !alias) {
    return Response.json({ error: "Missing required parameters" }, { status: 400 });
  }

  try {
    const link = await recordUserClickForLink(
      request,
      domain,
      alias,
      ip,
      country,
      city,
      continent,
      true, // skipAnalytics flag
    );

    if (!link) {
      console.log("Could not find the link you are looking for");
      return Response.json({ error: "Link not found" }, { status: 404 });
    }

    console.log("Link found:", link);

    const baseUrl = request.url.split("/api/link")[0];
    const cacheKey = buildCacheKey(domain, alias);

    // Redirect to blocked page for admin-blocked links
    if (link.blocked) {
      return Response.json({ url: `${baseUrl}/blocked/${link.id}` });
    }

    // Check link expiration (disabled, date-based, click-based)
    if (await checkLinkExpiration(link, cacheKey)) {
      return Response.json({ url: `${baseUrl}/expired/${link.id}` });
    }

    // Redirect to password verification page for protected links
    if (link.passwordHash) {
      return Response.json({ url: `${baseUrl}/verify-password/${link.id}` });
    }

    // Fetch geo rules (cache first, then DB)
    let geoRules = await getGeoRulesFromCache(link.id);
    if (!geoRules) {
      const rulesFromDb = await db.query.geoRule.findMany({
        where: eq(geoRule.linkId, link.id),
        orderBy: [asc(geoRule.priority)],
      });
      if (rulesFromDb.length > 0) {
        // Fire-and-forget cache population - don't block the response
        void setGeoRulesInCache(link.id, rulesFromDb);
        geoRules = rulesFromDb;
      }
    }

    // Match geo rules against visitor's country
    const geoResult = matchGeoRules(geoRules, country !== "Unknown" ? country : null);

    if (geoResult.matched) {
      if (geoResult.action === "block") {
        const geoParam = geoResult.ruleId ? `?geo=${geoResult.ruleId}` : "";
        return Response.json({ url: `${baseUrl}/blocked/${link.id}${geoParam}` });
      }

      // Redirect to geo-targeted destination
      // Record the click with geo rule info
      await recordUserClickWithGeoRule(
        request,
        domain,
        alias,
        ip,
        country,
        city,
        continent,
        geoResult.ruleId
      );

      const destinationUrl = appendUtmParams(geoResult.destination, link.utmParams as UtmParams);
      return Response.json({ url: destinationUrl });
    }

    // No geo rule matched - continue with default flow
    // Record the click only for actual redirections (non-password protected links)
    await recordUserClickForLink(
      request,
      domain,
      alias,
      ip,
      country,
      city,
      continent,
      false, // record analytics
    );

    // Validate link.url before processing
    if (!link.url) {
      console.error("Link has no URL:", link.id);
      return Response.json({ error: "Link has no destination URL" }, { status: 404 });
    }

    const destinationUrl = appendUtmParams(link.url, link.utmParams as UtmParams);
    return Response.json({ url: destinationUrl, cloaking: link.cloaking ?? false });
  } catch (error) {
    console.error("Error processing link:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
