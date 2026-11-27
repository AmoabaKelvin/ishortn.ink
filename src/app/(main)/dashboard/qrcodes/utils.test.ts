import { describe, expect, test } from "bun:test";

import { defaultGeneratorState } from "@/lib/qr-generator/state";
import { qrCodeStyleInput } from "@/server/api/routers/qrcode/qrcode.input";

import {
  checkIfUserCanCreateMoreQRCodes,
  emptyStaticFormValues,
  qrCodeFileName,
  pdfSizeCm,
  qrCodeStyleFrom,
  qrPreviewSrc,
  qrZipBaseNames,
  savedQrCodeSvgState,
  staticFormValuesFrom,
  staticTypeOf,
  SVG_EFFECTS_NOTE,
  SVG_LEGACY_NOTE,
  svgNoteFor,
  emptyVCardFormValues,
  validateStaticForm,
  validateVCardForm,
  vcardFormValuesFrom,
  vcardOf,
  vectorNoteFor,
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

describe("qrZipBaseNames", () => {
  test("names files by alias", () => {
    expect(qrZipBaseNames([{ alias: "spring-sale" }, { alias: "Menu_2026" }])).toEqual([
      "spring-sale",
      "Menu_2026",
    ]);
  });

  test("replaces characters file systems reject and keeps letters in other scripts", () => {
    expect(qrZipBaseNames([{ alias: "a/b:c" }, { alias: "café" }, { alias: "..hidden" }])).toEqual([
      "a-b-c",
      "café",
      "hidden",
    ]);
  });

  test("numbers repeats, ignoring case", () => {
    expect(
      qrZipBaseNames([
        { alias: "promo" },
        { alias: "Promo" },
        { alias: "promo-2" },
        { alias: "promo" },
      ]),
    ).toEqual(["promo", "Promo-2", "promo-2-2", "promo-3"]);
  });

  test("falls back to the title for codes without a link", () => {
    expect(qrZipBaseNames([{ alias: null, title: "Table 4" }, { title: null }])).toEqual([
      "table-4",
      "qr-code",
    ]);
  });
});

describe("qrPreviewSrc", () => {
  const link = { domain: "ishortn.ink", alias: "spring-sale" };

  test("prefers the stored image", () => {
    expect(
      qrPreviewSrc({ qrCode: "https://r2.example/a.png", style: null, color: "#000000", link }),
    ).toBe("https://r2.example/a.png");
  });

  test("draws codes without a stored image from their style", () => {
    const style = qrCodeStyleFrom(defaultGeneratorState(), undefined);
    const src = qrPreviewSrc({ qrCode: null, style, color: "#000000", link });
    expect(src?.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(decodeURIComponent(src!)).toContain("<path");
  });

  test("is null without an image or a link", () => {
    expect(qrPreviewSrc({ qrCode: null, style: null, color: "#000000", link: null })).toBeNull();
  });
});

describe("vectorNoteFor", () => {
  test("names the format", () => {
    expect(vectorNoteFor({ style: null }, "PDF")).toBe(
      "PDF uses the plain style for codes made before SVG export",
    );
  });
});

describe("pdfSizeCm", () => {
  test("presets", () => {
    expect(pdfSizeCm("2", "")).toEqual({ cm: 2 });
    expect(pdfSizeCm("5", "12")).toEqual({ cm: 5 });
  });

  test("custom sizes accept a decimal comma and round to a millimetre", () => {
    expect(pdfSizeCm("custom", "7,25")).toEqual({ cm: 7.3 });
  });

  test("rejects custom sizes out of range", () => {
    for (const value of ["", "0.5", "51", "abc"]) {
      expect(pdfSizeCm("custom", value)).toEqual({ error: "Enter a size from 1 to 50 cm" });
    }
  });
});

describe("static codes", () => {
  const style = qrCodeStyleFrom(defaultGeneratorState(), undefined);
  const wifi = {
    type: "wifi" as const,
    ssid: "Cafe",
    password: "latte",
    security: "WPA" as const,
    hidden: false,
  };
  const content = "WIFI:T:WPA;S:Cafe;P:latte;H:false;;";

  test("redraw from their own content and saved style", () => {
    const state = savedQrCodeSvgState({
      style,
      color: "#000000",
      link: null,
      contentType: "text",
      content,
    });
    expect(state?.text).toBe(content);
    // Legacy codes without a saved style or a link still can't be redrawn.
    expect(
      savedQrCodeSvgState({
        style: null,
        color: "#000000",
        link: null,
        contentType: "text",
        content,
      }),
    ).toBeNull();
    expect(
      savedQrCodeSvgState({ style, color: "#000000", link: null, contentType: "link", content }),
    ).toBeNull();
  });

  test("know their type, with plain text for codes without form fields", () => {
    expect(staticTypeOf({ contentType: "text", payloadFields: wifi })).toBe("wifi");
    expect(staticTypeOf({ contentType: "text", payloadFields: null })).toBe("text");
    expect(staticTypeOf({ contentType: "link", payloadFields: null })).toBeNull();
  });

  test("re-open their saved form fields", () => {
    expect(staticFormValuesFrom({ content, payloadFields: wifi })).toEqual({
      ...emptyStaticFormValues,
      ssid: "Cafe",
      password: "latte",
    });
    expect(staticFormValuesFrom({ content: "Hello", payloadFields: null }).text).toBe("Hello");
  });

  test("validate the active type's fields", () => {
    const missing = validateStaticForm("wifi", emptyStaticFormValues);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.fieldErrors.ssid).toBe("Enter the network name");

    const phone = validateStaticForm("phone", {
      ...emptyStaticFormValues,
      phone: "+1 415-555-0100",
    });
    expect(phone).toEqual({ ok: true, payload: { type: "phone", phone: "+14155550100" } });

    const email = validateStaticForm("email", { ...emptyStaticFormValues, to: "nope" });
    expect(email.ok || email.fieldErrors.to).toBe("Enter a valid email address");
  });
});

describe("contact card codes", () => {
  const card = {
    type: "vcard" as const,
    ...emptyVCardFormValues,
    firstName: "Ada",
    website: "https://example.com",
  };

  test("aren't static codes and read their card back", () => {
    expect(staticTypeOf({ contentType: "link", payloadFields: card })).toBeNull();
    expect(vcardOf({ payloadType: "vcard", payloadFields: card })).toEqual(card);
    expect(vcardOf({ payloadType: null, payloadFields: null })).toBeNull();
    expect(vcardFormValuesFrom(card)).toEqual({
      ...emptyVCardFormValues,
      firstName: "Ada",
      website: "https://example.com",
    });
  });

  test("validate the form, needing a first name or an organisation", () => {
    const missing = validateVCardForm(emptyVCardFormValues);
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.fieldErrors.firstName).toBe("Enter a first name or an organisation");
    }

    const valid = validateVCardForm({
      ...emptyVCardFormValues,
      organization: " Acme ",
      website: "acme.com",
    });
    expect(valid.ok && valid.card).toEqual({
      ...card,
      firstName: "",
      organization: "Acme",
      website: "https://acme.com",
    });
  });
});
