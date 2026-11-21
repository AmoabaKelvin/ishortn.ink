import { afterAll, describe, expect, test } from "bun:test";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import { MarkerFrames, PixelStyles } from "@/lib/qr-generator/types";
import * as schema from "@/server/db/schema";

import { qrcodeInput } from "./qrcode.input";
import { toLegacyQrStyles } from "./utils";

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
