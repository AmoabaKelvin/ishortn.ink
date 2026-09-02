import { asc, eq } from "drizzle-orm";

import { parseDeviceDetails } from "@/lib/core/analytics/visitor";
import {
  type Link,
  buildCacheKey,
  deleteFromCache,
  getGeoRulesFromCache,
  setGeoRulesInCache,
} from "@/lib/core/cache";
import { matchTargetingRules, rulesNeedDevice } from "@/lib/core/geo-rules/matcher";
import { logger } from "@/lib/logger";
import { runBackgroundTask } from "@/lib/utils/background";
import { generateVisitId, signVerifiedClickToken } from "@/lib/utils/verified-click-token";
import { recordClick, resolveLink } from "@/middlewares/record-click";
import { db } from "@/server/db";
import { geoRule, link as linkTable } from "@/server/db/schema";
import { getTotalClicks } from "@/server/lib/total-clicks";
import { isOwnerOnPaidPlan } from "@/server/lib/user-plan";

const log = logger.child({ component: "link-resolver" });

async function autoDisableLink(linkId: number, cacheKey: string): Promise<void> {
  try {
    await db.update(linkTable).set({ disabled: true }).where(eq(linkTable.id, linkId));
    await deleteFromCache(cacheKey);
  } catch (err) {
    log.error({ err, linkId }, "failed to auto-disable link");
  }
}

/**
 * True when the link must no longer resolve: manually disabled, past its expiry
 * date, or over its click cap. Shared with the password verifier so unlocking a
 * link can't outlive the owner's revocation.
 */
export async function checkLinkExpiration(link: Link, cacheKey: string): Promise<boolean> {
  if (link.disabled) {
    return true;
  }

  if (link.disableLinkAfterDate && new Date() >= link.disableLinkAfterDate) {
    void runBackgroundTask(autoDisableLink(link.id, cacheKey));
    return true;
  }

  if (link.disableLinkAfterClicks) {
    const clickCount = await getTotalClicks(link.id);

    if (clickCount >= link.disableLinkAfterClicks) {
      void runBackgroundTask(autoDisableLink(link.id, cacheKey));
      return true;
    }
  }

  return false;
}

/** True until the owner's scheduled activation instant has passed. */
export function isLinkScheduled(link: Pick<Link, "activateAt">): boolean {
  return !!link.activateAt && new Date() < link.activateAt;
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
        url.searchParams.set(key, value);
      }
    }

    return url.toString();
  } catch {
    return baseUrl;
  }
}

type ResolveShortLinkParams = {
  domain: string;
  alias: string;
  country: string;
  city: string;
  ip: string;
  headers: Headers;
  baseUrl: string;
};

export type LinkResolution = {
  url: string;
  cloaking?: boolean;
  visitId?: string | null;
  verificationToken?: string | null;
};

/**
 * Returns null when the alias doesn't resolve — including on unexpected
 * errors, so a resolver failure degrades to a 404 rather than a broken redirect.
 */
export async function resolveShortLink(
  params: ResolveShortLinkParams,
): Promise<LinkResolution | null> {
  const { domain, alias, country, city, ip, headers, baseUrl } = params;

  try {
    const link = await resolveLink(domain, alias);

    if (!link) {
      return null;
    }

    const cacheKey = buildCacheKey(domain, alias);

    if (link.blocked) {
      return { url: `${baseUrl}/blocked/${link.id}` };
    }

    if (await checkLinkExpiration(link, cacheKey)) {
      return { url: `${baseUrl}/expired/${link.id}` };
    }

    if (isLinkScheduled(link)) {
      return { url: `${baseUrl}/scheduled/${link.id}` };
    }

    // Password-protected links are tracked in verifyLinkPassword after unlock,
    // not here — the visitor hasn't actually reached the destination yet.
    if (link.passwordHash) {
      return { url: `${baseUrl}/verify-password/${link.id}` };
    }

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

    const device = rulesNeedDevice(geoRules) ? await parseDeviceDetails(headers) : null;
    const geoResult = matchTargetingRules(geoRules, {
      country: country !== "Unknown" ? country : null,
      device: device?.device ?? null,
      os: device?.os ?? null,
    });

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
        return { url: `${baseUrl}/blocked/${link.id}${geoParam}` };
      }

      const destinationUrl = appendUtmParams(geoResult.destination, link.utmParams as UtmParams);
      const { visitId, verificationToken } = issueToken(destinationUrl);

      void runBackgroundTask(
        recordClick({
          headers,
          link,
          ip,
          country,
          city,
          matchedGeoRuleId: geoResult.ruleId,
          visitId,
        }),
      );

      return { url: destinationUrl, visitId, verificationToken };
    }

    if (!link.url) {
      log.warn({ linkId: link.id, domain, alias }, "link has no destination URL");
      return null;
    }

    const destinationUrl = appendUtmParams(link.url, link.utmParams as UtmParams);
    const { visitId, verificationToken } = issueToken(destinationUrl);

    void runBackgroundTask(recordClick({ headers, link, ip, country, city, visitId }));

    return {
      url: destinationUrl,
      cloaking: link.cloaking ?? false,
      visitId,
      verificationToken,
    };
  } catch (error) {
    log.error({ err: error, domain, alias }, "failed to resolve link");
    return null;
  }
}
