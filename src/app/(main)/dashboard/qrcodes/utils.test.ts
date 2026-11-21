import { describe, expect, test } from "bun:test";

import { defaultGeneratorState } from "@/lib/qr-generator/state";
import { qrCodeStyleInput } from "@/server/api/routers/qrcode/qrcode.input";

import {
  checkIfUserCanCreateMoreQRCodes,
  qrCodeFileName,
  qrCodeStyleFrom,
  savedQrCodeSvgState,
  SVG_EFFECTS_NOTE,
  SVG_LEGACY_NOTE,
  svgNoteFor,
} from "./utils";

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

describe("SVG download state", () => {
  const link = { domain: "ishortn.ink", alias: "menu26" };
  const style = qrCodeStyleFrom(
    {
      ...defaultGeneratorState(),
      pixelStyle: "dot",
      markerFrame: "circle",
      darkColor: "#1d4ed8",
      lightColor: "#fef3c7",
      seed: 1234,
      logoImage: "https://cdn.example.com/logo.png",
    },
    undefined,
  );

  test("saved style keeps the effective error correction and passes the save input", () => {
    // The logo couldn't be read, but the PNG was still encoded at H.
    expect(style.ecc).toBe("H");
    expect(style.logoImage).toBeNull();
    expect(qrCodeStyleInput.safeParse(style).success).toBe(true);
  });

  test("saved style keeps PNG/JPEG logos and drops formats the save input rejects", () => {
    const state = { ...defaultGeneratorState(), logoImage: "blob:logo" };
    const png = "data:image/png;base64,iVBORw0KGgo=";
    expect(qrCodeStyleFrom(state, png).logoImage).toBe(png);
    for (const logo of [
      "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
      "data:image/webp;base64,UklGRhIAAABXRUJQ",
      "data:image/svg+xml;base64,PHN2Zy8+",
      `data:image/png;base64,${"A".repeat(3 * 1024 * 1024)}`,
    ]) {
      const saved = qrCodeStyleFrom(state, logo);
      expect(saved.logoImage).toBeNull();
      expect(saved.ecc).toBe("H");
      expect(qrCodeStyleInput.safeParse(saved).success).toBe(true);
    }
  });

  test("redraws a saved code from its style and tracking link", () => {
    const state = savedQrCodeSvgState({ style, color: "#1d4ed8", link });
    expect(state).toMatchObject({
      text: "https://ishortn.ink/menu26",
      pixelStyle: "dot",
      markerFrame: "circle",
      darkColor: "#1d4ed8",
      lightColor: "#fef3c7",
      seed: 1234,
      ecc: "H",
      scale: 20,
      logoImage: undefined,
    });
    expect(svgNoteFor({ style })).toBeNull();
    expect(svgNoteFor({ style: { ...style, effect: "liquidify" } })).toBe(SVG_EFFECTS_NOTE);
  });

  test("falls back to the plain style for codes saved without one", () => {
    const state = savedQrCodeSvgState({ style: null, color: "#ff0000", link });
    expect(state).toMatchObject({
      text: "https://ishortn.ink/menu26",
      pixelStyle: "square",
      markerFrame: "square",
      darkColor: "#ff0000",
      lightColor: "#ffffff",
    });
    expect(svgNoteFor({ style: null })).toBe(SVG_LEGACY_NOTE);
    expect(savedQrCodeSvgState({ style: null, color: "#ff0000", link: null })).toBeNull();
  });
});
