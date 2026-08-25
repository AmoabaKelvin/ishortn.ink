import { describe, expect, test } from "bun:test";

import { assertValidImageInput } from "./image-upload.service";

const PNG_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16),
]);
const PNG_DATA_URL = `data:image/png;base64,${PNG_BYTES.toString("base64")}`;

describe("assertValidImageInput", () => {
  test("passes through http(s) URLs without parsing them", () => {
    expect(assertValidImageInput("https://cdn.example/a.png")).toBeNull();
    expect(assertValidImageInput("http://cdn.example/a.png")).toBeNull();
  });

  test("rejects values that merely start with http", () => {
    expect(() => assertValidImageInput("http-not-a-url")).toThrow("Unsupported image format.");
    expect(() => assertValidImageInput("httpx://nope")).toThrow("Unsupported image format.");
  });

  test("accepts a well-formed data URL", () => {
    expect(assertValidImageInput(PNG_DATA_URL)?.format).toBe("png");
  });

  test("rejects unsupported data URLs and mislabelled bytes", () => {
    expect(() => assertValidImageInput("data:image/svg+xml;base64,PHN2Zz4=")).toThrow(
      "Unsupported image format.",
    );
    expect(() =>
      assertValidImageInput(`data:image/jpeg;base64,${PNG_BYTES.toString("base64")}`),
    ).toThrow("do not match");
  });

  test("rejects an oversized payload from its encoded length", () => {
    const oversized = `data:image/png;base64,${"A".repeat(3 * 1024 * 1024)}`;
    expect(() => assertValidImageInput(oversized)).toThrow("maximum size");
  });
});
