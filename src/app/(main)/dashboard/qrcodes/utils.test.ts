import { describe, expect, test } from "bun:test";

import { checkIfUserCanCreateMoreQRCodes, qrCodeFileName } from "./utils";

import type { RouterOutputs } from "@/trpc/shared";

type SubDetails = RouterOutputs["subscriptions"]["get"];

function withQrUsage(count: number, limit: number | null): SubDetails {
  // SAFETY: checkIfUserCanCreateMoreQRCodes only reads usage.qrCodes.
  return { usage: { qrCodes: { count, limit } } } as SubDetails;
}

describe("checkIfUserCanCreateMoreQRCodes", () => {
  test("allows creation while the subscription is unknown", () => {
    expect(checkIfUserCanCreateMoreQRCodes(undefined)).toBe(true);
  });

  test("allows creation under the limit and blocks at it", () => {
    expect(checkIfUserCanCreateMoreQRCodes(withQrUsage(4, 5))).toBe(true);
    expect(checkIfUserCanCreateMoreQRCodes(withQrUsage(5, 5))).toBe(false);
    expect(checkIfUserCanCreateMoreQRCodes(withQrUsage(7, 5))).toBe(false);
  });

  test("treats a null limit as unlimited", () => {
    expect(checkIfUserCanCreateMoreQRCodes(withQrUsage(500, null))).toBe(true);
  });
});

describe("qrCodeFileName", () => {
  test("slugifies the title", () => {
    expect(qrCodeFileName("Summer Menu 2026!")).toBe("summer-menu-2026.png");
    expect(qrCodeFileName("  Café  Flyer ")).toBe("cafe-flyer.png");
  });

  test("falls back when nothing survives", () => {
    expect(qrCodeFileName("")).toBe("qr-code.png");
    expect(qrCodeFileName(null)).toBe("qr-code.png");
    expect(qrCodeFileName("🎉🎉")).toBe("qr-code.png");
  });

  test("caps long titles without a trailing hyphen", () => {
    const name = qrCodeFileName(`${"a".repeat(79)} b`);
    expect(name).toBe(`${"a".repeat(79)}.png`);
  });
});
