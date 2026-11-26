import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import type { Me } from "../src/lib/api.ts";

// storage.ts resolves the extension namespace on import, so install a fake storage.local first.
const store: Record<string, unknown> = {};
(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: {
    local: {
      get: async (key: string) => (key in store ? { [key]: structuredClone(store[key]) } : {}),
      set: async (items: Record<string, unknown>) => Object.assign(store, structuredClone(items)),
      remove: async (key: string) => {
        delete store[key];
      },
    },
  },
};

let mod: typeof import("../src/lib/me-cache.ts");
before(async () => {
  mod = await import("../src/lib/me-cache.ts");
});

const ME: Me = {
  email: "ada@example.com",
  plan: "pro",
  linksUsedThisMonth: 12,
  linksLimit: null,
  domains: [{ domain: "go.acme.com", isDefault: true }],
  upgradeUrl: "https://ishortn.ink/dashboard/billing",
};

describe("meCache storage", () => {
  it("is empty before anything is saved", async () => {
    assert.equal(await mod.meCache.load(), null);
  });

  it("saves the account with savedAt and reads it back", async () => {
    await mod.meCache.save(ME, 1_700_000_000_000);
    assert.deepEqual(store.meCache, { me: ME, savedAt: 1_700_000_000_000 });
    assert.deepEqual(await mod.meCache.load(), ME);
  });

  it("clear removes it", async () => {
    await mod.meCache.save(ME);
    await mod.meCache.clear();
    assert.equal("meCache" in store, false);
    assert.equal(await mod.meCache.load(), null);
  });
});

describe("parseMeCache", () => {
  it("accepts a saved entry, including Free limits", () => {
    const free = { ...ME, plan: "free", linksLimit: 30, domains: [] };
    assert.deepEqual(mod.parseMeCache({ me: free, savedAt: 1 }), free);
  });

  it("rejects missing or malformed entries", () => {
    for (const value of [undefined, null, "x", {}, { me: null }, { me: { ...ME, plan: "gold" } }, { me: { ...ME, domains: null } }, { me: { ...ME, linksLimit: "30" } }]) {
      assert.equal(mod.parseMeCache(value), null);
    }
  });
});

describe("shouldAutoShorten", () => {
  it("defaults from the cached plan when the switch was never touched", () => {
    assert.equal(mod.shouldAutoShorten(undefined, "pro"), true);
    assert.equal(mod.shouldAutoShorten(undefined, "ultra"), true);
    assert.equal(mod.shouldAutoShorten(undefined, "free"), false);
  });

  it("follows the saved switch over the plan", () => {
    assert.equal(mod.shouldAutoShorten(false, "pro"), false);
    assert.equal(mod.shouldAutoShorten(true, "free"), true);
  });
});
