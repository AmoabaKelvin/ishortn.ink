import { afterAll, describe, expect, test } from "bun:test";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import { MarkerFrames, PixelStyles } from "@/lib/qr-generator/types";
import * as schema from "@/server/db/schema";

import { qrcodeInput } from "./qrcode.input";
import {
  bulkQrCodeLimitError,
  qrStyleFromPreset,
  storedQrImageSource,
  toLegacyQrStyles,
} from "./utils";

describe("toLegacyQrStyles", () => {
  test.each(PixelStyles)("pixel style %s maps to a legacy pattern style", (pixelStyle) => {
    const { patternStyle } = toLegacyQrStyles(pixelStyle, "square");
    expect(schema.qrcode.patternStyle.enumValues).toContain(patternStyle);
  });

  test.each(MarkerFrames)("marker frame %s maps to a legacy corner style", (markerFrame) => {
    const { cornerStyle } = toLegacyQrStyles("square", markerFrame);
    expect(schema.qrcode.cornerStyle.enumValues).toContain(cornerStyle);
  });

  test("keeps values the legacy enums already have", () => {
    expect(toLegacyQrStyles("rounded", "circle")).toEqual({
      patternStyle: "rounded",
      cornerStyle: "circle",
    });
  });
});

describe("bulkQrCodeLimitError", () => {
  test("Free plans can't create QR codes from an import", () => {
    expect(bulkQrCodeLimitError({ plan: "free", rowCount: 1, qrCodeCount: 0 })).toContain(
      "available on Pro and Ultra",
    );
  });

  test("Pro allows up to 100 per import", () => {
    expect(bulkQrCodeLimitError({ plan: "pro", rowCount: 100, qrCodeCount: 5000 })).toBeNull();
    expect(bulkQrCodeLimitError({ plan: "pro", rowCount: 101, qrCodeCount: 0 })).toContain(
      "up to 100 QR codes per import, and this file has 101 rows",
    );
  });

  test("Ultra has no per-import cap", () => {
    expect(bulkQrCodeLimitError({ plan: "ultra", rowCount: 1000, qrCodeCount: 0 })).toBeNull();
  });
});

describe("qrStyleFromPreset", () => {
  const preset = {
    pixelStyle: "dot",
    markerFrame: "circle",
    markerCenter: "eye",
    darkColor: "#1d4ed8",
    lightColor: "#ffffff",
    effect: "none",
    marginNoise: false,
    marginNoiseRate: "0.3",
    logoSize: 20,
    logoMargin: 4,
    logoBorderRadius: 8,
  };

  test("uses the preset's style and the import's seed", () => {
    expect(qrStyleFromPreset(preset, { seed: 42, hasLogo: false })).toMatchObject({
      pixelStyle: "dot",
      markerFrame: "circle",
      markerCenter: "eye",
      darkColor: "#1d4ed8",
      marginNoiseRate: 0.3,
      seed: 42,
      ecc: "M",
      logoImage: null,
    });
  });

  test("a logo raises error correction to H", () => {
    expect(qrStyleFromPreset(preset, { seed: 1, hasLogo: true }).ecc).toBe("H");
  });

  test("unknown stored values fall back to the defaults", () => {
    const style = qrStyleFromPreset(
      { ...preset, pixelStyle: "hexagon", effect: "glow" },
      { seed: 1, hasLogo: false },
    );
    expect(style.pixelStyle).toBe("rounded");
    expect(style.effect).toBe("none");
  });

  test("no preset gives the default style", () => {
    expect(qrStyleFromPreset(null, { seed: 1, hasLogo: false })).toMatchObject({
      pixelStyle: "rounded",
      markerFrame: "square",
      darkColor: "#000000",
    });
  });
});

describe("qrcodeInput", () => {
  const base = { patternStyle: "dot", cornerStyle: "tiny-plus", selectedColor: "#000000" };

  test("adds https:// to a scheme-less destination", () => {
    const parsed = qrcodeInput.parse({ ...base, content: "example.com" });
    expect(parsed.content).toBe("https://example.com");
  });

  test("rejects styles the generator doesn't offer", () => {
    const result = qrcodeInput.safeParse({
      ...base,
      content: "https://example.com",
      patternStyle: "hexagon",
    });
    expect(result.success).toBe(false);
  });
});

describe("storedQrImageSource", () => {
  const bucket = "https://pub-example.r2.dev";
  const personal = { userId: "user_abc", teamId: null };
  const team = { userId: "user_abc", teamId: 42 };

  test("serves the uploaded object from the code's own workspace prefix", () => {
    const url = `${bucket}/users/user_abc/qr-code/7.png`;
    expect(storedQrImageSource({ ...personal, qrCode: url }, bucket)).toEqual({
      type: "bucket",
      url,
    });
    const teamUrl = `${bucket}/teams/42/qr-code/7.png`;
    expect(storedQrImageSource({ ...team, qrCode: teamUrl }, bucket)).toEqual({
      type: "bucket",
      url: teamUrl,
    });
  });

  test("decodes a data URI saved before the upload finished", () => {
    const source = storedQrImageSource(
      { ...personal, qrCode: "data:image/png;base64,iVBORw0KGgo=" },
      bucket,
    );
    expect(source).toMatchObject({ type: "inline", contentType: "image/png" });
    expect(source?.type === "inline" && [...source.bytes.subarray(0, 4)]).toEqual([
      0x89, 0x50, 0x4e, 0x47,
    ]);
  });

  test("never fetches a URL outside the code's workspace prefix", () => {
    for (const qrCode of [
      `${bucket}/users/user_other/qr-code/7.png`,
      `${bucket}/teams/42/qr-code/7.png`,
      `${bucket}/users/user_abc/../user_other/qr-code/7.png`,
      `${bucket}/users/user_abc/%2e%2e/user_other/qr-code/7.png`,
      "https://attacker.example/qr.png",
      "http://169.254.169.254/latest/meta-data",
    ]) {
      expect(storedQrImageSource({ ...personal, qrCode }, bucket)).toBeNull();
    }
    expect(
      storedQrImageSource({ ...team, qrCode: `${bucket}/users/user_abc/qr-code/7.png` }, bucket),
    ).toBeNull();
  });

  test("returns null without a stored image", () => {
    expect(storedQrImageSource({ ...personal, qrCode: null }, bucket)).toBeNull();
    expect(storedQrImageSource({ ...personal, qrCode: "" }, bucket)).toBeNull();
  });
});

// Strict-mode MySQL rejects enum values outside the column definition. Set TEST_DATABASE_URL to
// run; see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("QR code legacy styles (MySQL)", () => {
  const pool = mysql.createPool({ uri: testDatabaseUrl ?? "", connectionLimit: 2 });
  const db = drizzle(pool, { schema, mode: "default" });
  const USER_ID = "qr_style_test_user";

  afterAll(async () => {
    await db.delete(schema.qrcode).where(eq(schema.qrcode.userId, USER_ID));
    await pool.end();
  });

  test("the session runs in strict mode", async () => {
    const [rows] = await pool.query("SELECT @@SESSION.sql_mode AS mode");
    // SAFETY: SELECT returns one row with the aliased column.
    const [{ mode }] = rows as { mode: string }[];
    expect(mode).toContain("STRICT_TRANS_TABLES");
  });

  const combinations = PixelStyles.flatMap((pixelStyle) =>
    MarkerFrames.map((markerFrame) => [pixelStyle, markerFrame] as const),
  );

  test.each(combinations)("saves pixel style %s with marker frame %s", async (pixel, frame) => {
    const [result] = await db.insert(schema.qrcode).values({
      userId: USER_ID,
      title: `${pixel}/${frame}`,
      content: "https://example.com",
      contentType: "link",
      color: "#000000",
      ...toLegacyQrStyles(pixel, frame),
    });
    expect(result.insertId).toBeGreaterThan(0);
  });
});
