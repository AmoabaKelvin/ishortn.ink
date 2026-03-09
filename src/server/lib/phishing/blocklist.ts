import { inArray } from "drizzle-orm";

import { db } from "@/server/db";
import { blockedDomain } from "@/server/db/schema";

type BlocklistResult = { blocked: boolean; reason: string };

export async function checkBlocklist(url: string): Promise<BlocklistResult> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return { blocked: false, reason: "" };
  }

  // Build list of hostname and all parent domains
  // e.g., for "sub.evil.tk", check "sub.evil.tk" and "evil.tk"
  const parts = hostname.split(".");
  const domainsToCheck: string[] = [];

  for (let i = 0; i < parts.length - 1; i++) {
    domainsToCheck.push(parts.slice(i).join("."));
  }

  if (domainsToCheck.length === 0) {
    return { blocked: false, reason: "" };
  }

  // Single query for all candidate domains
  const results = await db.query.blockedDomain.findMany({
    where: inArray(blockedDomain.domain, domainsToCheck),
  });

  if (results.length > 0) {
    // Match the most specific domain first (order matches domainsToCheck)
    for (const domain of domainsToCheck) {
      const match = results.find((r) => r.domain === domain);
      if (match) {
        return {
          blocked: true,
          reason: `Domain "${match.domain}" is on the blocklist${match.reason ? `: ${match.reason}` : ""}`,
        };
      }
    }
  }

  return { blocked: false, reason: "" };
}
