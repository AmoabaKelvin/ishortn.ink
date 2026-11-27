// Pageview and identity bookkeeping for posthog.ts, kept apart from it so it can be tested without
// loading posthog-js. `run` queues calls until PostHog loads.

import { SHORTEN_INTENT_COOKIE } from "@/lib/auth/shorten-intent";

type PageLocation = Pick<Location, "href" | "host" | "pathname">;

interface PageviewClient {
  capture(
    event: string,
    properties: Record<string, string | boolean>,
    options: { timestamp: Date },
  ): void;
}

interface IdentityClient {
  identify(distinctId: string): void;
  reset(): void;
  get_distinct_id(): string;
  get_property(name: string): string | undefined;
  opt_out_capturing(): void;
  opt_in_capturing(options: { captureEventName: false }): void;
  has_opted_out_capturing(): boolean;
}

type Run<T> = (call: (client: T) => void) => void;

const SIGN_UP_PAGE = /^\/auth\/sign-up(?:\/|$)/;

/**
 * Extra `$pageview` properties for `pathname`, given the page's `document.cookie`. A sign-up page
 * opened with a pending shorten intent (the homepage hero, the UTM builder) gets
 * `shorten_intent: true`, so that funnel can be read straight from page views. Only the flag is
 * sent, never the URL in the cookie.
 */
export function pageviewProperties(pathname: string, cookie: string): Record<string, true> {
  if (!SIGN_UP_PAGE.test(pathname)) return {};
  const prefix = `${SHORTEN_INTENT_COOKIE}=`;
  const hasIntent = cookie.split(";").some((pair) => {
    const trimmed = pair.trim();
    return trimmed.startsWith(prefix) && trimmed.length > prefix.length;
  });
  return hasIntent ? { shorten_intent: true } : {};
}

/**
 * Returns a function that sends a `$pageview` for the given location, unless the last one it sent
 * was for the same path. The initial load and the route effect's first run both report the same
 * page, and query-only changes (filters, pricing highlights) are not new pages. `readCookie`
 * returns `document.cookie`, for pageviewProperties.
 */
export function createPageviewTracker(run: Run<PageviewClient>, readCookie: () => string) {
  let lastPathname: string | null = null;
  return ({ href, host, pathname }: PageLocation) => {
    if (pathname === lastPathname) return;
    lastPathname = pathname;
    // Taken now: by the time PostHog loads, the visitor may have navigated again. Not the title:
    // posthog-js sets it from document.title when it sends a $pageview.
    const timestamp = new Date();
    // Read now too: middleware clears the intent cookie once the post-auth redirect lands.
    const extra = pageviewProperties(pathname, readCookie());
    run((posthog) =>
      posthog.capture(
        "$pageview",
        { $current_url: href, $host: host, $pathname: pathname, ...extra },
        { timestamp },
      ),
    );
  };
}

/**
 * Returns a function to call with the signed-in user's id (null when signed out). Identifies each
 * user once, so their anonymous history merges into their person, and resets on sign-out so later
 * events get a new anonymous id. Internal accounts are opted out of capturing instead of
 * identified; PostHog keeps the opt-out across page loads until a non-internal user signs in.
 */
export function createIdentityTracker(run: Run<IdentityClient>) {
  // undefined until the first call: the page doesn't know who PostHog last identified.
  let current: string | null | undefined;
  return (userId: string | null, internal = false) => {
    if (userId === current) return;
    current = userId;
    run((posthog) => {
      // PostHog persists identity across page loads, so a sign-out (or account switch) that ended
      // in a full page load is only noticed here.
      const identified = posthog.get_property("$user_state") === "identified";
      if (identified && posthog.get_distinct_id() !== userId) posthog.reset();
      if (!userId) return;
      if (internal) {
        posthog.opt_out_capturing();
        return;
      }
      // After reset(): reset clears consent, and opting in first would be undone by it.
      if (posthog.has_opted_out_capturing()) posthog.opt_in_capturing({ captureEventName: false });
      posthog.identify(userId);
    });
  };
}
