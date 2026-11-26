import { EXPAND_ERRORS } from "@/server/lib/url-expander/expand";

import type { SafetyVerdict } from "@/server/lib/url-expander/expand";

export const EXPANDER_ERRORS = {
  notAUrl: EXPAND_ERRORS.notAUrl,
  network: "The expander couldn't be reached. Check your connection and try again.",
};

const joinWithAnd = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

export const safetyMessage = (safety: SafetyVerdict): string => {
  if (safety.status === "unsafe") {
    const threats = safety.threats.length ? joinWithAnd(safety.threats) : "dangerous";
    return `Google Safe Browsing flags this link as ${threats}. Don't open it.`;
  }
  if (safety.status === "safe") return "No known threats found by Google Safe Browsing";
  return "Google Safe Browsing couldn't be reached, so this link wasn't checked. Look closely at the domain before you open it.";
};

/** Splits a URL around its host so the domain can be shown on its own. */
export const splitUrl = (url: string) => {
  try {
    const { protocol, host } = new URL(url);
    const scheme = `${protocol}//`;
    if (url.startsWith(`${scheme}${host}`)) {
      return { scheme, host, rest: url.slice(scheme.length + host.length) };
    }
  } catch {
    // Not a URL: show it as is.
  }
  return { scheme: "", host: "", rest: url };
};
