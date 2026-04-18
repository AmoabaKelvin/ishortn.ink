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
import { runBackgroundTask } from "@/lib/utils/background";
import {
  generateVisitId,
  signVerifiedClickToken,
} from "@/lib/utils/verified-click-token";
import { recordClick, resolveLink } from "@/middlewares/record-click";
import { db } from "@/server/db";
import { geoRule, link as linkTable, linkVisit } from "@/server/db/schema";
import { isOwnerOnPaidPlan } from "@/server/lib/user-plan";

/**
 * Mark a link as disabled in the DB and purge its cache entry. Runs in the
 * background so it doesn't block the redirect response, but uses waitUntil
 * so Vercel keeps the function alive until the update lands.
 */
async function autoDisableLink(linkId: number, cacheKey: string): Promise<void> {
  try {
    await db.update(linkTable).set({ disabled: true }).where(eq(linkTable.id, linkId));
    await deleteFromCache(cacheKey);
  } catch (err) {
    console.error("Failed to auto-disable link:", err);
  }
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
    void runBackgroundTask(autoDisableLink(link.id, cacheKey));
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
      void runBackgroundTask(autoDisableLink(link.id, cacheKey));
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
  // Visitor IP is forwarded by the middleware in a header (not the URL) so it
  // doesn't leak into request logs. Server-to-server fetches don't preserve
  // the original client IP, so re-deriving from the request isn't an option.
  const ip = request.headers.get("x-client-ip") ?? "";

  // Normalize geo params - treat "undefined", "null", empty strings as Unknown
  const rawCountry = searchParams.get("country");
  const rawCity = searchParams.get("city");

  const country = rawCountry && rawCountry !== "undefined" && rawCountry !== "null" ? rawCountry : "Unknown";
  const city = rawCity && rawCity !== "undefined" && rawCity !== "null" ? rawCity : "Unknown";

  if (!domain || !alias) {
    return Response.json({ error: "Missing required parameters" }, { status: 400 });
  }

  try {
    const link = await resolveLink(domain, alias);

    if (!link) {
      return Response.json({ error: "Link not found" }, { status: 404 });
    }

    const baseUrl = request.url.split("/api/link")[0];
    const cacheKey = buildCacheKey(domain, alias);

    // Redirect to blocked page for admin-blocked links (no click recorded)
    if (link.blocked) {
      return Response.json({ url: `${baseUrl}/blocked/${link.id}` });
    }

    // Check link expiration (disabled, date-based, click-based)
    if (await checkLinkExpiration(link, cacheKey)) {
      return Response.json({ url: `${baseUrl}/expired/${link.id}` });
    }

    // Password-protected links are tracked in verifyLinkPassword after unlock,
    // not here — the visitor hasn't actually reached the destination yet.
    if (link.passwordHash) {
      return Response.json({ url: `${baseUrl}/verify-password/${link.id}` });
    }

    // Geo-rules fetch and paid-plan check are independent; run them in parallel.
    // Token signing has to wait until we know the final destination so we can
    // bind it into the HMAC and prevent `to` tampering on the interstitial.
    const [cachedGeoRules, ownerPaid] = await Promise.all([
      getGeoRulesFromCache(link.id),
      link.verifiedClicksEnabled
        ? isOwnerOnPaidPlan(link.userId, link.teamId)
        : Promise.resolve(false),
    ]);

    let geoRules = cachedGeoRules;
    if (!geoRules) {
      const rulesFromDb = await db.query.geoRule.findMany({
        where: eq(geoRule.linkId, link.id),
        orderBy: [asc(geoRule.priority)],
      });
      if (rulesFromDb.length > 0) {
        void runBackgroundTask(setGeoRulesInCache(link.id, rulesFromDb));
        geoRules = rulesFromDb;
      }
    }

    const geoResult = matchGeoRules(geoRules, country !== "Unknown" ? country : null);

    const issueToken = (
      destination: string,
    ): { visitId: string | null; verificationToken: string | null } => {
      if (!ownerPaid) return { visitId: null, verificationToken: null };
      const candidate = generateVisitId();
      const token = signVerifiedClickToken(candidate, destination);
      return token
        ? { visitId: candidate, verificationToken: token }
        : { visitId: null, verificationToken: null };
    };

    if (geoResult.matched) {
      if (geoResult.action === "block") {
        const geoParam = geoResult.ruleId ? `?geo=${geoResult.ruleId}` : "";
        return Response.json({ url: `${baseUrl}/blocked/${link.id}${geoParam}` });
      }

      const destinationUrl = appendUtmParams(geoResult.destination, link.utmParams as UtmParams);
      const { visitId, verificationToken } = issueToken(destinationUrl);

      void runBackgroundTask(
        recordClick({
          headers: request.headers,
          link,
          ip,
          country,
          city,
          matchedGeoRuleId: geoResult.ruleId,
          visitId,
        }),
      );

      return Response.json({ url: destinationUrl, visitId, verificationToken });
    }

    if (!link.url) {
      console.error("Link has no URL:", link.id);
      return Response.json({ error: "Link has no destination URL" }, { status: 404 });
    }

    const destinationUrl = appendUtmParams(link.url, link.utmParams as UtmParams);
    const { visitId, verificationToken } = issueToken(destinationUrl);

    void runBackgroundTask(
      recordClick({ headers: request.headers, link, ip, country, city, visitId }),
    );

    return Response.json({
      url: destinationUrl,
      cloaking: link.cloaking ?? false,
      visitId,
      verificationToken,
    });
  } catch (error) {
    console.error("Error processing link:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
