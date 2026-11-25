import { describe, expect, it } from "bun:test";

import { getNavigationKind } from "./navigation-kind";

describe("getNavigationKind", () => {
  it("is full when the document was loaded at the auth URL", () => {
    expect(
      getNavigationKind({
        documentUrl: "https://ishortn.ink/auth/sign-up?redirect_url=%2Fdashboard",
        currentPath: "/auth/sign-up",
        placeholderMountedBefore: false,
      }),
    ).toBe("full");
  });

  it("is client when the document was loaded at a marketing page", () => {
    expect(
      getNavigationKind({
        documentUrl: "https://ishortn.ink/",
        currentPath: "/auth/sign-up",
        placeholderMountedBefore: false,
      }),
    ).toBe("client");
  });

  it("is client when switching between auth pages in the same document", () => {
    expect(
      getNavigationKind({
        documentUrl: "https://ishortn.ink/auth/sign-in",
        currentPath: "/auth/sign-up",
        placeholderMountedBefore: false,
      }),
    ).toBe("client");
    expect(
      getNavigationKind({
        documentUrl: "https://ishortn.ink/auth/sign-in",
        currentPath: "/auth/sign-in",
        placeholderMountedBefore: true,
      }),
    ).toBe("client");
  });

  it("is client when no navigation entry is available", () => {
    expect(
      getNavigationKind({
        documentUrl: undefined,
        currentPath: "/auth/sign-up",
        placeholderMountedBefore: false,
      }),
    ).toBe("client");
  });
});
