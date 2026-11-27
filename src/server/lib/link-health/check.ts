import { checkHttpUrl } from "@/server/lib/ssrf";

import type { LinkHealthError } from "@/lib/link-health";

export const LINK_CHECK_USER_AGENT = "iShortnLinkCheck/1.0 (+https://ishortn.ink/abuse)";
export const LINK_CHECK_TIMEOUT_MS = 10_000;
export const LINK_CHECK_MAX_REDIRECTS = 5;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * One destination check. `ok` clears a link's failure streak, `failure` extends it, and
 * `inconclusive` (auth walls, rate limits, bot challenges, addresses we refuse to fetch) leaves
 * the link's state as it was: the page may well work for people.
 */
export type CheckResult =
  | { kind: "ok"; status: number }
  | { kind: "failure"; status: number | null; error: LinkHealthError | null }
  | { kind: "inconclusive" };

export type CheckDeps = {
  fetch?: typeof fetch;
  resolve?: (hostname: string) => Promise<string[]>;
  timeoutMs?: number;
  /** Called once per outbound request (DNS lookups and fetches), for the run's budget. */
  onSubrequest?: (count: number) => void;
};

/** Requests one check can make at most: a DNS pair, HEAD and GET per hop. */
export const MAX_SUBREQUESTS_PER_CHECK = (LINK_CHECK_MAX_REDIRECTS + 1) * 4;

export function classifyStatus(status: number, headers: Headers): CheckResult {
  // Cloudflare marks its bot challenges, whatever status they come with.
  if (headers.get("cf-mitigated") === "challenge") return { kind: "inconclusive" };
  if (status >= 200 && status < 400) return { kind: "ok", status };
  if (status === 404 || status === 410 || (status >= 500 && status < 600)) {
    return { kind: "failure", status, error: null };
  }
  // 401/403/429 and non-standard codes (LinkedIn's 999) say the server is up but won't serve a
  // bot; other 4xx are as likely to be about the request as the page.
  return { kind: "inconclusive" };
}

export function classifyFetchError(error: Error): LinkHealthError {
  if (error.name === "TimeoutError" || error.name === "AbortError") return "timeout";
  // Node puts the system error (ENOTFOUND, CERT_HAS_EXPIRED…) in `cause`; workerd only has a message.
  const cause = error.cause instanceof Error ? error.cause : null;
  const source = cause ?? error;
  const code = "code" in source ? String(source.code) : "";
  const text = `${error.message} ${code} ${cause?.message ?? ""}`;
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo|dns/i.test(text)) return "dns_failure";
  if (/cert|tls|ssl|handshake/i.test(text)) return "tls_error";
  return "connection_failed";
}

/**
 * Checks whether `url` still serves a page: HEAD (GET when the server refuses HEAD), following
 * up to 5 redirects, each hop re-validated as a public address like `safeFetch` does. Response
 * bodies are never read.
 */
export async function checkDestination(url: string, deps: CheckDeps = {}): Promise<CheckResult> {
  const doFetch = deps.fetch ?? fetch;
  const timeoutMs = deps.timeoutMs ?? LINK_CHECK_TIMEOUT_MS;
  let current = url;

  for (let hop = 0; hop <= LINK_CHECK_MAX_REDIRECTS; hop++) {
    deps.onSubrequest?.(2);
    const address = await checkHttpUrl(current, deps.resolve);
    if (address === "unresolved") return { kind: "failure", status: null, error: "dns_failure" };
    if (address !== "public") return { kind: "inconclusive" };

    let response: Response | null = null;
    for (const method of ["HEAD", "GET"] as const) {
      deps.onSubrequest?.(1);
      try {
        response = await doFetch(current, {
          method,
          redirect: "manual",
          headers: { "User-Agent": LINK_CHECK_USER_AGENT, Accept: "*/*" },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        const reason = error instanceof Error ? error : new Error(String(error));
        return { kind: "failure", status: null, error: classifyFetchError(reason) };
      }
      // Free the connection: only the status and headers matter.
      await response.body?.cancel().catch(() => undefined);
      if (method === "HEAD" && (response.status === 405 || response.status === 501)) continue;
      break;
    }
    if (!response) return { kind: "inconclusive" };

    const location = response.headers.get("location");
    if (!REDIRECT_STATUSES.has(response.status) || !location) {
      return classifyStatus(response.status, response.headers);
    }
    try {
      current = new URL(location, current).toString();
    } catch {
      return { kind: "inconclusive" };
    }
  }

  return { kind: "failure", status: null, error: "too_many_redirects" };
}
