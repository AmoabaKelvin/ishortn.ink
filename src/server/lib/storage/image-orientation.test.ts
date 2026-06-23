import { describe, expect, test } from "bun:test";
import sharp from "sharp";

import { normalizeImageOrientation } from "./image-orientation";

function jpegWithOrientation(orientation: number): Promise<Buffer> {
  return sharp({ create: { width: 2, height: 4, channels: 3, background: { r: 200, g: 0, b: 0 } } })
    .jpeg()
    .withMetadata({ orientation })
    .toBuffer();
}

describe("normalizeImageOrientation", () => {
  test("strips a non-upright EXIF orientation from JPEG", async () => {
    const oriented = await jpegWithOrientation(3); // 180° / upside-down
    expect((await sharp(oriented).metadata()).orientation).toBe(3);

    const fixed = await normalizeImageOrientation(oriented, "jpeg");
    const after = (await sharp(fixed).metadata()).orientation;
    expect(after === undefined || after === 1).toBe(true);
  });

  test("leaves an already-upright JPEG untouched (no re-encode)", async () => {
    const upright = await jpegWithOrientation(1);
    const result = await normalizeImageOrientation(upright, "jpeg");
    expect(result).toBe(upright); // same buffer reference
  });

  test("passes non-JPEG formats through unchanged", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    expect(await normalizeImageOrientation(png, "png")).toBe(png);
    expect(await normalizeImageOrientation(png, "webp")).toBe(png);
  });

  test("returns the original bytes when the input can't be parsed", async () => {
    const garbage = Buffer.from("not an image");
    expect(await normalizeImageOrientation(garbage, "jpeg")).toBe(garbage);
  });
});
