import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";

import { env } from "@/env.mjs";

import { captureServerEvent } from "./posthog-server";

// test/setup.ts unsets the PostHog key; these tests configure a fake one and intercept fetch, so
// nothing leaves the process.
describe("captureServerEvent", () => {
  const original = {
    NEXT_PUBLIC_POSTHOG_KEY: env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: env.NEXT_PUBLIC_POSTHOG_HOST,
  };
  let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;

  beforeEach(() => {
    Object.assign(env, {
      NEXT_PUBLIC_POSTHOG_KEY: "phc_test",
      NEXT_PUBLIC_POSTHOG_HOST: "https://posthog.invalid",
    });
    fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    Object.assign(env, original);
  });

  test("sends the event under the user's id", () => {
    captureServerEvent({ id: "user_1", email: "ada@example.com" }, "extension_limit_hit", {
      plan: "free",
      limit_key: "monthly_links",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const init = fetchSpy.mock.calls[0]?.[1];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      api_key: "phc_test",
      event: "extension_limit_hit",
      distinct_id: "user_1",
      properties: { plan: "free", limit_key: "monthly_links" },
    });
  });

  test("sends nothing for internal accounts", () => {
    captureServerEvent({ id: "user_qa", email: "qa@euploading.com" }, "extension_limit_hit");
    captureServerEvent({ id: "user_bot", email: "bot@mail.ishortn.ink" }, "extension_connected");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("sends nothing when PostHog isn't configured", () => {
    Object.assign(env, { NEXT_PUBLIC_POSTHOG_KEY: undefined });
    captureServerEvent({ id: "user_1", email: "ada@example.com" }, "extension_link_created");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
