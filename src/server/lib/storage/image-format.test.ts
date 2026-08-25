import { describe, expect, test } from "bun:test";

import { hasDeclaredImageFormat } from "./image-format";

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16),
]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(16), Buffer.from([0xff, 0xd9])]);
const GIF = Buffer.concat([Buffer.from("GIF89a", "latin1"), Buffer.alloc(16)]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF", "latin1"),
  Buffer.alloc(4),
  Buffer.from("WEBP", "latin1"),
  Buffer.alloc(16),
]);
// A TIFF header is a decoder libvips would happily pick up if the label were trusted.
const TIFF = Buffer.concat([Buffer.from([0x49, 0x49, 0x2a, 0x00]), Buffer.alloc(32)]);

describe("hasDeclaredImageFormat", () => {
  test("accepts bytes matching the declared format", () => {
    expect(hasDeclaredImageFormat("png", PNG)).toBe(true);
    expect(hasDeclaredImageFormat("jpeg", JPEG)).toBe(true);
    expect(hasDeclaredImageFormat("gif", GIF)).toBe(true);
    expect(hasDeclaredImageFormat("webp", WEBP)).toBe(true);
  });

  test("rejects bytes labelled as a different format", () => {
    expect(hasDeclaredImageFormat("jpeg", PNG)).toBe(false);
    expect(hasDeclaredImageFormat("webp", PNG)).toBe(false);
    expect(hasDeclaredImageFormat("png", JPEG)).toBe(false);
  });

  test("rejects non-image payloads and unknown formats", () => {
    expect(hasDeclaredImageFormat("jpeg", TIFF)).toBe(false);
    expect(hasDeclaredImageFormat("svg", PNG)).toBe(false);
    expect(hasDeclaredImageFormat("png", Buffer.from("short"))).toBe(false);
  });
});
