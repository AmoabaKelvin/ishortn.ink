import crypto from "crypto";
import { sql } from "drizzle-orm";
import { UAParser } from "ua-parser-js";

import { getFromCache, Link } from "@/lib/core/cache";
import { isBot } from "@/lib/utils/is-bot";
import { db } from "@/server/db";
import { linkVisit, uniqueLinkVisit } from "@/server/db/schema";

async function recordClick(
  req: Request,
  link: Link,
  from: string,
  ip: string,
  country: string,
  city: string,
  continent: string
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
      parsedUserAgent.device.type ??
      deviceTypesMapping[parsedUserAgent.os.name ?? ""] ??
      "Unknown",
    model: parsedUserAgent.device.model ?? "Unknown",
  };

  const ipHash = crypto.createHash("sha256").update(ip).digest("hex");

  await Promise.all([
    db.insert(linkVisit).values({
      linkId: link.id,
      ...deviceDetails,
      referer: parseReferrer(headers.get("referer")),
      country: country ?? "Unknown",
      city: city ?? "Unknown",
      continent: continent ?? "Unknown",
    }),
    db
      .insert(uniqueLinkVisit)
      .values({
        linkId: link.id,
        ipHash,
      })
      .onDuplicateKeyUpdate({
        set: {
          ipHash,
        },
      }),
  ]);
}

export async function recordUserClickForLink(
  req: Request,
  domain: string,
  alias: string,
  ip: string,
  country: string,
  city: string,
  continent: string
) {
  const cleanedDomain = domain
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "");
  const cacheKey = `${
    domain.includes("localhost") ? "ishortn.ink" : cleanedDomain
  }:${alias}`;
  console.log(cacheKey);
  const cachedLink: Link | null = await getFromCache(cacheKey);

  if (cachedLink) {
    console.log(
      "this is a cached link and as such the work has been cut short"
    );
    await recordClick(
      req,
      cachedLink,
      req.referrer ?? "direct",
      ip,
      country,
      city,
      continent
    );
    return cachedLink;
  }

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

  await recordClick(
    req,
    link,
    req.referrer ?? "direct",
    ip,
    country,
    city,
    continent
  );

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
