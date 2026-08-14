import { beforeAll, describe, expect, mock, test } from "bun:test";
import { decode, encode } from "@jsquash/jpeg";
import exifr from "exifr";

import { normalizeImageOrientation } from "./image-orientation";

// Minimal little-endian EXIF APP1 segment holding only the orientation tag
// (0x0112), spliced in right after the JPEG SOI marker.
function injectExifOrientation(jpeg: Buffer, orientation: number): Buffer {
  const tiff = Buffer.from([
    0x49,
    0x49,
    0x2a,
    0x00,
    0x08,
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    0x12,
    0x01,
    0x03,
    0x00,
    0x01,
    0x00,
    0x00,
    0x00,
    orientation,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
  ]);
  const payload = Buffer.concat([Buffer.from("Exif\0\0", "ascii"), tiff]);
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, 0x00, 0x00]), payload]);
  app1.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
}

async function encodeJpeg(data: Uint8ClampedArray, width: number, height: number) {
  return Buffer.from(await encode({ data, width, height, colorSpace: "srgb" }, { quality: 90 }));
}

async function jpegWithOrientation(orientation: number): Promise<Buffer> {
  const width = 8;
  const height = 16;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 200;
    data[i + 3] = 255;
  }
  return injectExifOrientation(await encodeJpeg(data, width, height), orientation);
}

describe("normalizeImageOrientation", () => {
  test("strips a non-upright EXIF orientation from JPEG", async () => {
    const oriented = await jpegWithOrientation(3); // 180° / upside-down
    expect(await exifr.orientation(oriented)).toBe(3);

    const fixed = await normalizeImageOrientation(oriented, "jpeg");
    const after = await exifr.orientation(fixed);
    expect(after === undefined || after === 1).toBe(true);
  });

  test("bakes a 90° rotation into the pixels for orientation 6", async () => {
    // Black 16x32 image with a white top-left 8x8 block; rotating 90° CW puts
    // the white block in the top-right corner and swaps the dimensions.
    const width = 16;
    const height = 32;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const white = x < 8 && y < 8 ? 255 : 0;
        const i = (y * width + x) * 4;
        data[i] = white;
        data[i + 1] = white;
        data[i + 2] = white;
        data[i + 3] = 255;
      }
    }
    const oriented = injectExifOrientation(await encodeJpeg(data, width, height), 6);

    const fixed = await normalizeImageOrientation(oriented, "jpeg");
    const image = await decode(
      fixed.buffer.slice(fixed.byteOffset, fixed.byteOffset + fixed.byteLength) as ArrayBuffer,
    );
    expect(image.width).toBe(height);
    expect(image.height).toBe(width);
    const pixel = (x: number, y: number) => image.data[(y * image.width + x) * 4]!;
    expect(pixel(image.width - 4, 4)).toBeGreaterThan(128); // top-right: white
    expect(pixel(4, 4)).toBeLessThan(128); // top-left: black
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

// Locally sharp is installed, so the suite above exercises the sharp path.
// Mocking sharp away forces the @jsquash/jpeg WASM path used on Workers.
// This describe must stay last: mock.module cannot be undone.
describe("normalizeImageOrientation without sharp (Workers path)", () => {
  beforeAll(() => {
    mock.module("sharp", () => ({ default: undefined }));
  });

  test("strips a non-upright EXIF orientation from JPEG", async () => {
    const oriented = await jpegWithOrientation(3);
    expect(await exifr.orientation(oriented)).toBe(3);

    const fixed = await normalizeImageOrientation(oriented, "jpeg");
    expect(fixed).not.toBe(oriented);
    const after = await exifr.orientation(fixed);
    expect(after === undefined || after === 1).toBe(true);
  });

  test("bakes a 90° rotation into the pixels for orientation 6", async () => {
    const width = 16;
    const height = 32;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const white = x < 8 && y < 8 ? 255 : 0;
        const i = (y * width + x) * 4;
        data[i] = white;
        data[i + 1] = white;
        data[i + 2] = white;
        data[i + 3] = 255;
      }
    }
    const oriented = injectExifOrientation(await encodeJpeg(data, width, height), 6);

    const fixed = await normalizeImageOrientation(oriented, "jpeg");
    const image = await decode(
      fixed.buffer.slice(fixed.byteOffset, fixed.byteOffset + fixed.byteLength) as ArrayBuffer,
    );
    expect(image.width).toBe(height);
    expect(image.height).toBe(width);
    const pixel = (x: number, y: number) => image.data[(y * image.width + x) * 4]!;
    expect(pixel(image.width - 4, 4)).toBeGreaterThan(128); // top-right: white
    expect(pixel(4, 4)).toBeLessThan(128); // top-left: black
  });

  test("returns the original bytes when the input can't be parsed", async () => {
    const garbage = Buffer.from("not an image");
    expect(await normalizeImageOrientation(garbage, "jpeg")).toBe(garbage);
  });
});
