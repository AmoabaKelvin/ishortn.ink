import { describe, expect, test } from "bun:test";

import { clerkJSScriptUrl, clerkUIScriptUrl } from "@clerk/shared/loadClerkJsScript";

import { clerkScriptVersions, pinnedVersion } from "./clerk-script-versions.cjs";

const publishableKey = `pk_live_${Buffer.from("clerk.ishortn.ink$").toString("base64")}`;

describe("clerkScriptVersions", () => {
  test("reads exact versions from the installed Clerk SDK", () => {
    const { js, ui } = clerkScriptVersions();
    expect(js).toMatch(/^\d+\.\d+\.\d+$/);
    expect(ui).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("pins the script URLs to the same major the SDK requests by default", () => {
    const { js, ui } = clerkScriptVersions();
    const defaultJs = clerkJSScriptUrl({ publishableKey });
    const defaultUi = clerkUIScriptUrl({ publishableKey });

    expect(clerkJSScriptUrl({ publishableKey, __internal_clerkJSVersion: js })).toBe(
      defaultJs.replace(/@clerk\/clerk-js@\d+\//, `@clerk/clerk-js@${js}/`),
    );
    expect(clerkUIScriptUrl({ publishableKey, __internal_clerkUIVersion: ui })).toBe(
      defaultUi.replace(/@clerk\/ui@\d+\//, `@clerk/ui@${ui}/`),
    );
  });
});

describe("pinnedVersion", () => {
  const url = "https://clerk.ishortn.ink/npm/@clerk/clerk-js@6/dist/clerk.browser.js";

  test("returns the version literal when its major matches the default URL", () => {
    expect(pinnedVersion('(v, packageVersion = "6.46.3") => v', url, "clerk-js")).toBe("6.46.3");
  });

  test("falls back to the major tag when the majors differ", () => {
    expect(pinnedVersion('(v, packageVersion = "7.0.0") => v', url, "clerk-js")).toBeUndefined();
  });

  test("falls back to the major tag when no version literal is found", () => {
    expect(pinnedVersion("(v, packageVersion) => v", url, "clerk-js")).toBeUndefined();
  });
});
