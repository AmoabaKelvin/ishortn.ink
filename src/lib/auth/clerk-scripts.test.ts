import { describe, expect, test } from "bun:test";

import { getClerkScripts } from "./clerk-scripts";

const publishableKey = `pk_live_${btoa("clerk.ishortn.ink$")}`;

describe("getClerkScripts", () => {
  test("points at the frontend API host from the publishable key", () => {
    const clerk = getClerkScripts({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: publishableKey });
    expect(clerk?.origin).toBe("https://clerk.ishortn.ink");
    expect(clerk?.scripts).toHaveLength(2);
    expect(clerk?.scripts[0]).toMatch(
      /^https:\/\/clerk\.ishortn\.ink\/npm\/@clerk\/clerk-js@[^/]+\/dist\/clerk\.browser\.js$/,
    );
    expect(clerk?.scripts[1]).toMatch(
      /^https:\/\/clerk\.ishortn\.ink\/npm\/@clerk\/ui@[^/]+\/dist\/ui\.browser\.js$/,
    );
  });

  test("follows a pinned Clerk JS version", () => {
    const clerk = getClerkScripts({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: publishableKey,
      NEXT_PUBLIC_CLERK_JS_VERSION: "6.1.0",
    });
    expect(clerk?.scripts[0]).toContain("/@clerk/clerk-js@6.1.0/");
  });

  test("has no origin to preconnect to behind a same-origin proxy", () => {
    const clerk = getClerkScripts({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: publishableKey,
      NEXT_PUBLIC_CLERK_PROXY_URL: "/__clerk",
    });
    expect(clerk?.origin).toBeNull();
    expect(clerk?.scripts[0]).toStartWith("/__clerk/npm/@clerk/clerk-js@");
  });

  test("returns null without a publishable key", () => {
    expect(getClerkScripts({})).toBeNull();
  });
});
