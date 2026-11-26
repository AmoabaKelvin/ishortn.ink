import { z } from "zod";

import { parseUrl } from "@/app/(landing)/_lib/parse-url";

import type { SafeBrowsingResult } from "@/server/lib/phishing/google-safe-browsing";
import type { HttpUrlCheck } from "@/server/lib/ssrf";

export const MAX_REDIRECTS = 10;
export const HOP_TIMEOUT_MS = 5000;
export const EXPANDER_USER_AGENT = "iShortn URL Expander (+https://ishortn.ink/url-expander)";

// Enough of an HTML document to cover its <head>, where a meta refresh lives.
const META_REFRESH_SCAN_BYTES = 32 * 1024;
const META_REFRESH = /<meta[^>]+http-equiv\s*=\s*["']?refresh/i;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export const EXPAND_ERRORS = {
  notAUrl: "That doesn't look like a web address.",
  timeout: "The link didn't respond within 5 seconds.",
  tooManyRedirects: `More than ${MAX_REDIRECTS} redirects; stopped.`,
  private: "That address points to a private network and can't be checked.",
  unresolved: "That domain doesn't exist or has no web server.",
  unreachable: "We couldn't connect to that address.",
  missingOwnLink: "No iShortn link uses that address.",
  appLink: "The link sends you to an app or a non-web address, which can't be checked.",
} as const;

export type ExpandHop = {
  url: string;
  status: number;
  /** Resolved from iShortn's database rather than over HTTP. */
  ishortn?: boolean;
};

export type SafetyVerdict =
  | { status: "safe" }
  | { status: "unsafe"; threats: string[] }
  | { status: "unknown" };

export type ExpandResult =
  | {
      ok: true;
      hops: ExpandHop[];
      finalUrl: string;
      /** Why an iShortn link stops here instead of redirecting (blocked, expired, ...). */
      note: string | null;
      /** The final page is HTML with a meta refresh or a Refresh header. */
      mayRedirectAgain: boolean;
      safety: SafetyVerdict;
    }
  | { ok: false; error: string };

/** How an address on one of our own domains resolves, read from the database. */
export type OwnLinkOutcome =
  | { type: "redirect"; location: string }
  | { type: "stop"; status: number; note: string }
  | { type: "page" }
  | { type: "missing" };

export type ExpandDeps = {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  checkUrl: (url: string) => Promise<HttpUrlCheck>;
  /** null when the address isn't on one of our domains. */
  resolveOwnLink: (url: URL) => Promise<OwnLinkOutcome | null>;
  checkSafety: (url: string) => Promise<SafeBrowsingResult>;
  hopTimeoutMs?: number;
};

const THREAT_LABELS = new Map([
  ["MALWARE", "malware"],
  ["SOCIAL_ENGINEERING", "phishing"],
  ["UNWANTED_SOFTWARE", "unwanted software"],
  ["POTENTIALLY_HARMFUL_APPLICATION", "a harmful app"],
]);

export const describeThreats = (threats: string[]): string[] => [
  ...new Set(threats.map((threat) => THREAT_LABELS.get(threat) ?? threat.toLowerCase())),
];

const toSafetyVerdict = (result: SafeBrowsingResult): SafetyVerdict => {
  if (result.status === "unsafe") {
    return { status: "unsafe", threats: describeThreats(result.threats) };
  }
  return result.status === "safe" ? { status: "safe" } : { status: "unknown" };
};

class ExpandError extends Error {}

// AbortSignal.timeout rejects with a DOMException, which isn't an Error on every runtime.
const timeoutErrorSchema = z.object({ name: z.enum(["TimeoutError", "AbortError"]) });

async function request(deps: ExpandDeps, url: string, method: "HEAD" | "GET"): Promise<Response> {
  try {
    return await deps.fetch(url, {
      method,
      redirect: "manual",
      headers: { "user-agent": EXPANDER_USER_AGENT, accept: "text/html,*/*;q=0.8" },
      signal: AbortSignal.timeout(deps.hopTimeoutMs ?? HOP_TIMEOUT_MS),
    });
  } catch (error) {
    throw new ExpandError(
      timeoutErrorSchema.safeParse(error).success
        ? EXPAND_ERRORS.timeout
        : EXPAND_ERRORS.unreachable,
    );
  }
}

/** HEAD first; GET when the server rejects HEAD. Bodies are never read here. */
async function requestHop(deps: ExpandDeps, url: string): Promise<Response> {
  const head = await request(deps, url, "HEAD");
  if (head.status < 400) return head;
  void head.body?.cancel().catch(() => undefined);

  return request(deps, url, "GET");
}

async function readPrefix(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  try {
    while (bytes < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    void reader.cancel().catch(() => undefined);
  }
  return text;
}

/**
 * Whether the final page may send the browser on again. Reads at most the first
 * META_REFRESH_SCAN_BYTES of an HTML page; nothing is kept or shown.
 */
async function hasClientRedirect(deps: ExpandDeps, url: string, last: Response) {
  if (last.headers.has("refresh")) return true;
  if (!last.headers.get("content-type")?.includes("text/html")) {
    void last.body?.cancel().catch(() => undefined);
    return false;
  }

  try {
    const page = last.body && !last.bodyUsed ? last : await request(deps, url, "GET");
    if (page.headers.has("refresh")) return true;
    return META_REFRESH.test(await readPrefix(page, META_REFRESH_SCAN_BYTES));
  } catch {
    return false;
  }
}

type Walk = {
  hops: ExpandHop[];
  finalUrl: string;
  note: string | null;
  last: Response | null;
};

async function walk(deps: ExpandDeps, start: string): Promise<Walk> {
  const hops: ExpandHop[] = [];
  let current = start;

  for (;;) {
    let url: URL;
    try {
      url = new URL(current);
    } catch {
      throw new ExpandError(EXPAND_ERRORS.notAUrl);
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new ExpandError(EXPAND_ERRORS.appLink);
    }

    let next: string;
    const own = await deps.resolveOwnLink(url);
    if (own) {
      if (own.type === "missing") throw new ExpandError(EXPAND_ERRORS.missingOwnLink);
      if (own.type === "page") {
        hops.push({ url: current, status: 200, ishortn: true });
        return { hops, finalUrl: current, note: null, last: null };
      }
      if (own.type === "stop") {
        hops.push({ url: current, status: own.status, ishortn: true });
        return { hops, finalUrl: current, note: own.note, last: null };
      }
      // Next.js `redirect()` answers with a 307, which is what a visitor would get.
      hops.push({ url: current, status: 307, ishortn: true });
      next = own.location;
    } else {
      const check = await deps.checkUrl(current);
      if (check === "private") throw new ExpandError(EXPAND_ERRORS.private);
      if (check === "unresolved") throw new ExpandError(EXPAND_ERRORS.unresolved);
      if (check === "invalid") throw new ExpandError(EXPAND_ERRORS.notAUrl);

      const response = await requestHop(deps, current);
      const location = response.headers.get("location");
      hops.push({ url: current, status: response.status });
      if (!REDIRECT_STATUSES.has(response.status) || !location) {
        return { hops, finalUrl: current, note: null, last: response };
      }
      void response.body?.cancel().catch(() => undefined);
      try {
        next = new URL(location, current).toString();
      } catch {
        throw new ExpandError(EXPAND_ERRORS.notAUrl);
      }
    }

    // `hops` holds every redirect followed so far; one more would exceed the cap.
    if (hops.length >= MAX_REDIRECTS + 1) throw new ExpandError(EXPAND_ERRORS.tooManyRedirects);
    current = next;
  }
}

/**
 * Follows a link's redirects one hop at a time, without rendering or keeping any page, and
 * checks the final address with Google Safe Browsing. Every HTTP hop is re-validated, so a
 * redirect can't steer the request into a private network. Links on our own domains are read
 * from the database and never count as a click.
 */
export async function expandUrl(input: string, deps: ExpandDeps): Promise<ExpandResult> {
  const parsed = parseUrl(input);
  if (!parsed.ok) return { ok: false, error: EXPAND_ERRORS.notAUrl };

  let result: Walk;
  try {
    result = await walk(deps, new URL(parsed.url).toString());
  } catch (error) {
    if (error instanceof ExpandError) return { ok: false, error: error.message };
    throw error;
  }

  const { hops, finalUrl, note, last } = result;
  const [mayRedirectAgain, safety] = await Promise.all([
    last ? hasClientRedirect(deps, finalUrl, last) : false,
    deps.checkSafety(finalUrl),
  ]);

  return { ok: true, hops, finalUrl, note, mayRedirectAgain, safety: toSafetyVerdict(safety) };
}
