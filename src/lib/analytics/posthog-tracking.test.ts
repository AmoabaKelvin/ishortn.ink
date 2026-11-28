import { describe, expect, test } from "bun:test";

import { createDeferredClient } from "./deferred-client";
import {
  createIdentityTracker,
  createPageviewTracker,
  pageviewProperties,
} from "./posthog-tracking";

function page(pathname: string, search = "") {
  return { href: `https://ishortn.ink${pathname}${search}`, host: "ishortn.ink", pathname };
}

function fakePostHog(distinctId = "anon-1", userState = "anonymous", optedOut = false) {
  const calls: string[] = [];
  const client = {
    distinctId,
    userState,
    optedOut,
    capture: (event: string, properties: Record<string, string>) =>
      calls.push(`${event} ${properties.$pathname}`),
    identify: (id: string) => {
      calls.push(`identify ${id}`);
      client.distinctId = id;
      client.userState = "identified";
    },
    reset: () => {
      calls.push("reset");
      client.distinctId = "anon-2";
      client.userState = "anonymous";
      client.optedOut = false;
    },
    opt_out_capturing: () => {
      calls.push("opt out");
      client.optedOut = true;
    },
    opt_in_capturing: () => {
      calls.push("opt in");
      client.optedOut = false;
    },
    has_opted_out_capturing: () => client.optedOut,
    get_distinct_id: () => client.distinctId,
    get_property: (name: string) => (name === "$user_state" ? client.userState : undefined),
  };
  return { client, calls };
}

describe("createPageviewTracker", () => {
  test("counts the initial page once and each client-side navigation after it", () => {
    const { client, calls } = fakePostHog();
    const track = createPageviewTracker(
      (call) => call(client),
      () => "",
    );

    // loadPostHog, then the route effect's first run, report the same page.
    track(page("/"));
    track(page("/"));
    track(page("/pricing"));
    track(page("/pricing", "?highlight=pro"));
    track(page("/auth/sign-up"));
    track(page("/"));

    expect(calls).toEqual([
      "$pageview /",
      "$pageview /pricing",
      "$pageview /auth/sign-up",
      "$pageview /",
    ]);
  });

  test("keeps the URL and time of the navigation while PostHog is still loading", () => {
    const queued: ((client: { capture: (...args: unknown[]) => void }) => void)[] = [];
    const track = createPageviewTracker(
      (call) => queued.push(call),
      () => "",
    );
    track(page("/pricing", "?highlight=pro"));

    const sent: unknown[][] = [];
    for (const call of queued) call({ capture: (...args) => sent.push(args) });
    expect(sent).toHaveLength(1);
    const [event, properties, options] = sent[0] ?? [];
    expect(event).toBe("$pageview");
    expect(properties).toEqual({
      $current_url: "https://ishortn.ink/pricing?highlight=pro",
      $host: "ishortn.ink",
      $pathname: "/pricing",
    });
    expect(options).toEqual({ timestamp: expect.any(Date) });
  });

  test("flags a sign-up page view that has a pending shorten intent, without its URL", () => {
    const sent: unknown[] = [];
    let cookie = "ph_x=1; ish_shorten_url=https%3A%2F%2Fexample.com%2Fsome%2Flong%2Fpage";
    const track = createPageviewTracker(
      (call) => call({ capture: (_event, properties) => sent.push(properties) }),
      () => cookie,
    );
    track(page("/auth/sign-up"));
    cookie = "";
    track(page("/auth/sign-up/verify-email-address"));

    expect(sent).toEqual([
      {
        $current_url: "https://ishortn.ink/auth/sign-up",
        $host: "ishortn.ink",
        $pathname: "/auth/sign-up",
        shorten_intent: true,
      },
      {
        $current_url: "https://ishortn.ink/auth/sign-up/verify-email-address",
        $host: "ishortn.ink",
        $pathname: "/auth/sign-up/verify-email-address",
      },
    ]);
  });
});

describe("pageviewProperties", () => {
  const intent = "ish_shorten_url=https%3A%2F%2Fexample.com";

  test("sets shorten_intent on sign-up pages when the intent cookie has a value", () => {
    expect(pageviewProperties("/auth/sign-up", intent)).toEqual({ shorten_intent: true });
    expect(pageviewProperties("/auth/sign-up/verify-email-address", `a=1; ${intent}`)).toEqual({
      shorten_intent: true,
    });
  });

  test("adds nothing without the cookie, with an empty one, or off the sign-up page", () => {
    expect(pageviewProperties("/auth/sign-up", "a=1")).toEqual({});
    expect(pageviewProperties("/auth/sign-up", "ish_shorten_url=")).toEqual({});
    expect(pageviewProperties("/auth/sign-up", "x_ish_shorten_url=1")).toEqual({});
    expect(pageviewProperties("/auth/sign-in", intent)).toEqual({});
    expect(pageviewProperties("/auth/sign-upx", intent)).toEqual({});
    expect(pageviewProperties("/", intent)).toEqual({});
  });
});

describe("createIdentityTracker", () => {
  test("identifies each user id once", () => {
    const { client, calls } = fakePostHog();
    const sync = createIdentityTracker((call) => call(client));

    sync("user_1");
    sync("user_1");
    sync("user_1");

    expect(calls).toEqual(["identify user_1"]);
  });

  test("resets on sign-out and identifies the next user", () => {
    const { client, calls } = fakePostHog();
    const sync = createIdentityTracker((call) => call(client));

    sync("user_1");
    sync(null);
    sync(null);
    sync("user_2");

    expect(calls).toEqual(["identify user_1", "reset", "identify user_2"]);
  });

  test("resets an identity left over from a previous page load when signed out", () => {
    const { client, calls } = fakePostHog("user_1", "identified");
    createIdentityTracker((call) => call(client))(null);
    expect(calls).toEqual(["reset"]);
  });

  test("does nothing for an anonymous visitor who is signed out", () => {
    const { client, calls } = fakePostHog();
    createIdentityTracker((call) => call(client))(null);
    expect(calls).toEqual([]);
  });

  test("switches to a different account without merging it into the previous one", () => {
    const { client, calls } = fakePostHog("user_1", "identified");
    createIdentityTracker((call) => call(client))("user_2");
    expect(calls).toEqual(["reset", "identify user_2"]);
  });

  test("opts internal accounts out of capturing instead of identifying them", () => {
    const { client, calls } = fakePostHog();
    createIdentityTracker((call) => call(client))("user_qa", true);
    expect(calls).toEqual(["opt out"]);
    expect(client.optedOut).toBe(true);
  });

  test("an internal account leaves no identity behind from an earlier user", () => {
    const { client, calls } = fakePostHog("user_1", "identified");
    createIdentityTracker((call) => call(client))("user_qa", true);
    expect(calls).toEqual(["reset", "opt out"]);
  });

  test("opts back in when a non-internal user signs in after an internal one", () => {
    const { client, calls } = fakePostHog("anon-1", "anonymous", true);
    const sync = createIdentityTracker((call) => call(client));

    sync(null);
    sync("user_1");

    expect(calls).toEqual(["opt in", "identify user_1"]);
    expect(client.optedOut).toBe(false);
  });

  test("a sign-out reset before Clerk navigates runs before the sign-out continues", async () => {
    // Mirrors resetPostHogIdentity: Clerk reports the signed-out state only after it has left the
    // app, so the sign-out buttons reset first and wait for it.
    const { client, calls } = fakePostHog();
    const deferred = createDeferredClient<typeof client>(10);
    const sync = createIdentityTracker(deferred.run);
    sync("user_1");

    const reset = (() => {
      sync(null);
      return deferred.runWithin(() => {}, 1000);
    })();
    deferred.ready(client);
    await reset;
    calls.push("clerk signOut");

    expect(calls).toEqual(["identify user_1", "reset", "clerk signOut"]);
    expect(client.distinctId).toBe("anon-2");
  });
});
