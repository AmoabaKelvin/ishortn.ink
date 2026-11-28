import { describe, expect, test } from "bun:test";
import { crc32, inflateSync } from "node:zlib";

import { encode } from "uqr";

import { generateQRCodePng } from "./png";

const TEXT = "https://isht.app/abc123";

function readChunks(png: Uint8Array) {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const chunks: { type: string; data: Uint8Array; crcOk: boolean }[] = [];
  for (let offset = 8; offset < png.length;) {
    const length = view.getUint32(offset);
    const type = new TextDecoder().decode(png.subarray(offset + 4, offset + 8));
    const data = png.subarray(offset + 8, offset + 8 + length);
    const crc = view.getUint32(offset + 8 + length);
    chunks.push({
      type,
      data,
      crcOk: crc32(png.subarray(offset + 4, offset + 8 + length)) === crc,
    });
    offset += 12 + length;
  }
  return chunks;
}

describe("generateQRCodePng", () => {
  test("writes a valid 1-bit indexed PNG with checksummed chunks", () => {
    const png = generateQRCodePng(TEXT, { scale: 4 });
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const chunks = readChunks(png);
    expect(chunks.map((chunk) => chunk.type)).toEqual(["IHDR", "PLTE", "IDAT", "IEND"]);
    expect(chunks.every((chunk) => chunk.crcOk)).toBe(true);

    const header = new DataView(chunks[0]!.data.buffer, chunks[0]!.data.byteOffset);
    const { size } = encode(TEXT, { ecc: "M", border: 4 });
    expect(header.getUint32(0)).toBe(size * 4);
    expect(header.getUint32(4)).toBe(size * 4);
    expect([...chunks[0]!.data.subarray(8)]).toEqual([1, 3, 0, 0, 0]);
  });

  test("draws every module of the code, scaled, inside the quiet zone", () => {
    const scale = 3;
    const png = generateQRCodePng(TEXT, { scale });
    const raw = inflateSync(readChunks(png).find((chunk) => chunk.type === "IDAT")!.data);

    const { size, data } = encode(TEXT, { ecc: "M", border: 4 });
    const width = size * scale;
    const rowBytes = Math.ceil(width / 8);
    expect(raw.length).toBe((rowBytes + 1) * width);

    const pixel = (x: number, y: number) =>
      (raw[y * (rowBytes + 1) + 1 + (x >> 3)]! & (0x80 >> (x & 7))) !== 0;
    for (let y = 0; y < width; y++) {
      expect(raw[y * (rowBytes + 1)]).toBe(0);
      for (let x = 0; x < width; x++) {
        expect(pixel(x, y)).toBe(data[Math.floor(y / scale)]![Math.floor(x / scale)]!);
      }
    }
    // The border rows are light.
    expect(data[0]!.some(Boolean)).toBe(false);
  });

  test("splits image data larger than one stored deflate block", () => {
    const long = `https://isht.app/${"a".repeat(200)}`;
    const png = generateQRCodePng(long, { scale: 20 });
    const idat = readChunks(png).find((chunk) => chunk.type === "IDAT")!.data;
    expect(idat.length).toBeGreaterThan(0xffff);
    expect(() => inflateSync(idat)).not.toThrow();
  });
});
