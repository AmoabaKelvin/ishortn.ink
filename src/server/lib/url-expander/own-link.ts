import { and, eq } from "drizzle-orm";

import { getBlockedLinkMessage } from "@/components/link-status/utils";
import { isPlatformDomain } from "@/lib/constants/domains";
import { APP_TOP_LEVEL_SEGMENTS } from "@/lib/seo/indexing";
import { appendUtmParams } from "@/middlewares/link-policy";
import { findLinkByAlias } from "@/middlewares/record-click";
import { getLinkStateRoute } from "@/middlewares/resolve-link";
import { db } from "@/server/db";
import { customDomain } from "@/server/db/schema";

import type { OwnLinkOutcome } from "./expand";

const isOwnHost = async (host: string): Promise<boolean> => {
  if (isPlatformDomain(host)) return true;
  const [row] = await db
    .select({ id: customDomain.id })
    .from(customDomain)
    .where(and(eq(customDomain.domain, host), eq(customDomain.status, "active")))
    .limit(1);
  return !!row;
};

/**
 * Where an address on one of our domains leads, read the way a "!" preview reads it: the same
 * state checks as the redirect, but no click or visit is recorded. Null for any other host.
 * Our own domains are never requested over HTTP, which would count as a visit.
 */
export async function resolveOwnLink(url: URL): Promise<OwnLinkOutcome | null> {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!(await isOwnHost(host))) return null;

  let path: string;
  try {
    path = decodeURIComponent(url.pathname.slice(1));
  } catch {
    return { type: "missing" };
  }
  // The home page, app pages and nested paths aren't short links.
  if (!path || path.includes("/") || (isPlatformDomain(host) && APP_TOP_LEVEL_SEGMENTS.has(path))) {
    return { type: "page" };
  }

  const alias = (path.endsWith("!") ? path.slice(0, -1) : path).toLowerCase();
  const link = await findLinkByAlias({ alias, domain: host });
  if (!link?.url) return { type: "missing" };

  // Geo rules are evaluated for an unknown country, so only rules that apply everywhere block.
  const stateRoute = await getLinkStateRoute(link, { country: "Unknown", headers: new Headers() });
  if (stateRoute?.startsWith("/blocked/")) {
    return { type: "stop", status: 403, note: getBlockedLinkMessage(link.blockedReason) };
  }
  if (stateRoute?.startsWith("/expired/")) {
    return { type: "stop", status: 410, note: "This iShortn link has expired." };
  }
  if (stateRoute) {
    return { type: "stop", status: 200, note: "This iShortn link isn't active yet." };
  }
  if (link.passwordHash) {
    return {
      type: "stop",
      status: 200,
      note: "This iShortn link is password-protected, so its destination isn't shown.",
    };
  }

  return { type: "redirect", location: appendUtmParams(link.url, link.utmParams) };
}
