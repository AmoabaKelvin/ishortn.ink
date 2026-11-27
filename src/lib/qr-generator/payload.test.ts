import { describe, expect, test } from "bun:test";
import { inflateSync } from "node:zlib";

import jsQR from "jsqr";

import {
  encodeEmail,
  encodePhone,
  encodeSms,
  encodeStaticQrPayload,
  encodeWifi,
  escapeWifiValue,
  staticPayloadSummary,
  staticQrPayloadSchema,
} from "./payload";
import { createQrInstance } from "./pixels";
import { generateQRCodePng } from "./png";
import { defaultGeneratorState } from "./state";

describe("encodeWifi", () => {
  test("encodes a WPA network", () => {
    expect(
      encodeWifi({ ssid: "Cafe Guest", password: "latte2026", security: "WPA", hidden: false }),
    ).toBe("WIFI:T:WPA;S:Cafe Guest;P:latte2026;H:false;;");
  });

  test("escapes backslash, semicolon, comma, colon and double quote", () => {
    expect(escapeWifiValue(`a\\b;c,d:e"f`)).toBe(`a\\\\b\\;c\\,d\\:e\\"f`);
    expect(
      encodeWifi({ ssid: `My;Net,1`, password: `p:a"s\\s`, security: "WPA", hidden: true }),
    ).toBe(`WIFI:T:WPA;S:My\\;Net\\,1;P:p\\:a\\"s\\\\s;H:true;;`);
  });

  test("leaves the password out of open networks", () => {
    expect(
      encodeWifi({ ssid: "Lobby", password: "stale", security: "nopass", hidden: false }),
    ).toBe("WIFI:T:nopass;S:Lobby;P:;H:false;;");
  });
});

describe("encodeEmail", () => {
  test("URL-encodes spaces and turns newlines into CRLF", () => {
    expect(
      encodeEmail({ to: "hello@example.com", subject: "Table booking", body: "Hi,\nFor 4 & 2" }),
    ).toBe("mailto:hello@example.com?subject=Table%20booking&body=Hi%2C%0D%0AFor%204%20%26%202");
  });

  test("omits empty subject and body", () => {
    expect(encodeEmail({ to: "a@b.co", subject: "", body: "" })).toBe("mailto:a@b.co");
    expect(encodeEmail({ to: "a@b.co", subject: "", body: "x y" })).toBe(
      "mailto:a@b.co?body=x%20y",
    );
  });
});

describe("encodeSms and encodePhone", () => {
  test("encode the number and message", () => {
    expect(encodeSms({ phone: "+14155550100", message: "Book: 2 people" })).toBe(
      "SMSTO:+14155550100:Book: 2 people",
    );
    expect(encodePhone({ phone: "+447700900123" })).toBe("tel:+447700900123");
  });
});

describe("staticQrPayloadSchema", () => {
  test("strips phone formatting and rejects letters", () => {
    const parsed = staticQrPayloadSchema.parse({ type: "phone", phone: " +1 (415) 555-0100 " });
    expect(encodeStaticQrPayload(parsed)).toBe("tel:+14155550100");
    expect(staticQrPayloadSchema.safeParse({ type: "phone", phone: "call me" }).success).toBe(
      false,
    );
    expect(
      staticQrPayloadSchema.safeParse({ type: "sms", phone: "12+34", message: "" }).success,
    ).toBe(false);
  });

  test("requires an SSID, and a password unless the network is open", () => {
    const wifi = { type: "wifi", ssid: "Office", password: "", security: "WPA", hidden: false };
    expect(staticQrPayloadSchema.safeParse({ ...wifi, ssid: "" }).success).toBe(false);
    const missingPassword = staticQrPayloadSchema.safeParse(wifi);
    expect(missingPassword.success).toBe(false);
    expect(missingPassword.error?.issues[0]?.path).toEqual(["password"]);
    expect(staticQrPayloadSchema.safeParse({ ...wifi, security: "nopass" }).success).toBe(true);
  });

  test("rejects an invalid email address", () => {
    const email = { type: "email", to: "not-an-email", subject: "", body: "" };
    expect(staticQrPayloadSchema.safeParse(email).success).toBe(false);
    expect(staticQrPayloadSchema.safeParse({ ...email, to: "hi@example.com" }).success).toBe(true);
  });
});

test("staticPayloadSummary never includes the Wi-Fi password", () => {
  expect(
    staticPayloadSummary({
      type: "wifi",
      ssid: "Cafe",
      password: "secret",
      security: "WPA",
      hidden: false,
    }),
  ).toBe("Cafe");
});

/** RGBA pixels of a PNG written by generateQRCodePng (1-bit palette, unfiltered rows). */
function decodePngPixels(png: Uint8Array) {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let width = 0;
  const idat: Uint8Array[] = [];
  for (let offset = 8; offset < png.length;) {
    const length = view.getUint32(offset);
    const type = new TextDecoder().decode(png.subarray(offset + 4, offset + 8));
    if (type === "IHDR") width = view.getUint32(offset + 8);
    if (type === "IDAT") idat.push(png.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const rowBytes = Math.ceil(width / 8) + 1;
  const pixels = new Uint8ClampedArray(width * width * 4);
  for (let y = 0; y < width; y++) {
    for (let x = 0; x < width; x++) {
      const dark = (raw[y * rowBytes + 1 + (x >> 3)]! >> (7 - (x & 7))) & 1;
      pixels.fill(dark ? 0 : 255, (y * width + x) * 4, (y * width + x) * 4 + 3);
      pixels[(y * width + x) * 4 + 3] = 255;
    }
  }
  return { pixels, width };
}

/** RGBA pixels of the module matrix the in-app generator draws for `text`. */
function appModulePixels(text: string, logo: boolean) {
  const qr = createQrInstance({
    ...defaultGeneratorState(),
    text,
    logoImage: logo ? "data:image/png;base64,AA==" : undefined,
  });
  const scale = 8;
  const margin = 4;
  const width = (qr.size + margin * 2) * scale;
  const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (!qr.data[y]![x]) continue;
      for (let dy = 0; dy < scale; dy++) {
        const row = (y + margin) * scale + dy;
        const start = (row * width + (x + margin) * scale) * 4;
        for (let i = 0; i < scale; i++) pixels.fill(0, start + i * 4, start + i * 4 + 3);
      }
    }
  }
  return { pixels, width };
}

describe("scanning a Wi-Fi code", () => {
  const payload = staticQrPayloadSchema.parse({
    type: "wifi",
    ssid: `Cafe "Bean";2,Main:St\\`,
    password: 'p@ss;word,with:all"chars\\',
    security: "WPA",
    hidden: false,
  });
  const content = encodeStaticQrPayload(payload);

  test("decodes the rendered PNG to the exact payload", () => {
    const { pixels, width } = decodePngPixels(generateQRCodePng(content, { scale: 6 }));
    expect(jsQR(pixels, width, width)?.data).toBe(content);
    expect(content).toBe(
      `WIFI:T:WPA;S:Cafe \\"Bean\\"\\;2\\,Main\\:St\\\\;P:p@ss\\;word\\,with\\:all\\"chars\\\\;H:false;;`,
    );
  });

  test("decodes the in-app generator's modules, with and without a logo", () => {
    for (const logo of [false, true]) {
      const { pixels, width } = appModulePixels(content, logo);
      expect(jsQR(pixels, width, width)?.data).toBe(content);
    }
  });
});
