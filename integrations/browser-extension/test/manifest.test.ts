import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildManifest } from "../scripts/manifest.mjs";

describe("buildManifest", () => {
  it("keeps the store name and description within the store limits", () => {
    for (const target of ["chrome", "firefox"] as const) {
      const manifest = buildManifest(target, { version: "0.1.0" });
      assert.equal(manifest.name, "iShortn: URL Shortener & QR Code Generator");
      assert.equal(manifest.short_name, "iShortn");
      assert.ok(manifest.name.length <= 75);
      assert.ok((manifest.description ?? "").length <= 132);
      assert.equal(manifest.action?.default_title, "Shorten with iShortn");
    }
  });

  it("declares Firefox data collection with a min version that supports it", () => {
    const { browser_specific_settings } = buildManifest("firefox", { version: "0.1.0" });
    assert.deepEqual(browser_specific_settings?.gecko, {
      id: "browser-extension@ishortn.ink",
      strict_min_version: "140.0",
      data_collection_permissions: { required: ["authenticationInfo", "browsingActivity"] },
    });
  });

  it("leaves Firefox settings out of the Chrome manifest", () => {
    const manifest = buildManifest("chrome", { version: "0.1.0" });
    assert.equal(manifest.browser_specific_settings, undefined);
    assert.deepEqual(manifest.background, { service_worker: "background.js" });
  });
});
