// Pageview and identity bookkeeping for posthog.ts, kept apart from it so it can be tested without
// loading posthog-js. `run` queues calls until PostHog loads.

type PageLocation = Pick<Location, "href" | "host" | "pathname">;

interface PageviewClient {
  capture(event: string, properties: Record<string, string>, options: { timestamp: Date }): void;
}

interface IdentityClient {
  identify(distinctId: string): void;
  reset(): void;
  get_distinct_id(): string;
  get_property(name: string): string | undefined;
}

type Run<T> = (call: (client: T) => void) => void;

/**
 * Returns a function that sends a `$pageview` for the given location, unless the last one it sent
 * was for the same path. The initial load and the route effect's first run both report the same
 * page, and query-only changes (filters, pricing highlights) are not new pages.
 */
export function createPageviewTracker(run: Run<PageviewClient>) {
  let lastPathname: string | null = null;
  return ({ href, host, pathname }: PageLocation) => {
    if (pathname === lastPathname) return;
    lastPathname = pathname;
    // Taken now: by the time PostHog loads, the visitor may have navigated again. Not the title:
    // posthog-js sets it from document.title when it sends a $pageview.
    const timestamp = new Date();
    run((posthog) =>
      posthog.capture(
        "$pageview",
        { $current_url: href, $host: host, $pathname: pathname },
        { timestamp },
      ),
    );
  };
}

/**
 * Returns a function to call with the signed-in user's id (null when signed out). Identifies each
 * user once, so their anonymous history merges into their person, and resets on sign-out so later
 * events get a new anonymous id.
 */
export function createIdentityTracker(run: Run<IdentityClient>) {
  // undefined until the first call: the page doesn't know who PostHog last identified.
  let current: string | null | undefined;
  return (userId: string | null) => {
    if (userId === current) return;
    current = userId;
    run((posthog) => {
      // PostHog persists identity across page loads, so a sign-out (or account switch) that ended
      // in a full page load is only noticed here.
      const identified = posthog.get_property("$user_state") === "identified";
      if (identified && posthog.get_distinct_id() !== userId) posthog.reset();
      if (userId) posthog.identify(userId);
    });
  };
}
