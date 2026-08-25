import { describe, expect, test } from "bun:test";
import sharp from "sharp";

import { hasDeclaredImageFormat } from "./image-format";

function encode(format: "png" | "jpeg" | "gif" | "webp"): Promise<Buffer> {
  return sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 1, g: 2, b: 3 } } })
    .toFormat(format)
    .toBuffer();
}

describe("hasDeclaredImageFormat", () => {
  test("accepts bytes matching the declared format", async () => {
    for (const format of ["png", "jpeg", "gif", "webp"] as const) {
      expect([format, hasDeclaredImageFormat(format, await encode(format))]).toEqual([format, true]);
    }
  });

  test("rejects bytes labelled as a different format", async () => {
    const png = await encode("png");
    expect(hasDeclaredImageFormat("jpeg", png)).toBe(false);
    expect(hasDeclaredImageFormat("webp", png)).toBe(false);
  });

  test("rejects non-image payloads and unknown formats", async () => {
    // A TIFF header is a decoder libvips would happily pick up if the label were trusted.
    const tiff = Buffer.concat([Buffer.from([0x49, 0x49, 0x2a, 0x00]), Buffer.alloc(32)]);
    expect(hasDeclaredImageFormat("jpeg", tiff)).toBe(false);
    expect(hasDeclaredImageFormat("svg", await encode("png"))).toBe(false);
    expect(hasDeclaredImageFormat("png", Buffer.from("short"))).toBe(false);
  });
});
