import { describe, expect, test } from "bun:test";

import { encode } from "uqr";

import { buildQRPath, qrStrokeWidth, type QRStyle } from "./qr-path";

const STYLES: QRStyle[] = ["square", "rounded", "dot", "squircle"];
const grid = [
  [true, false],
  [false, true],
];

describe("buildQRPath", () => {
  test("emits one subpath per dark module at its cell offset", () => {
    expect(buildQRPath(grid, "square")).toBe("M0.05 0.05h.9v.9h-.9zM1.05 1.05h.9v.9h-.9z");
    expect(buildQRPath(grid, "rounded")).toBe("M0.35 0.35h.3v.3h-.3zM1.35 1.35h.3v.3h-.3z");
    expect(buildQRPath(grid, "dot")).toBe("M0.5 0.5h0M1.5 1.5h0");
    expect(buildQRPath(grid, "squircle")).toBe("M0.5 0.5h0M1.5 1.5h0");
  });

  test("returns an empty path for an all-light grid", () => {
    for (const style of STYLES) expect(buildQRPath([[false]], style)).toBe("");
  });

  test("stroked styles keep every module inside its 0.05 inset", () => {
    // Inner shape side plus stroke width must equal the 0.9 module.
    expect(0.3 + qrStrokeWidth("rounded")).toBeCloseTo(0.9);
    expect(qrStrokeWidth("dot")).toBe(0.9);
    expect(qrStrokeWidth("squircle")).toBe(0.9);
    expect(qrStrokeWidth("square")).toBe(0);
  });

  test("stays small for the homepage code", () => {
    const { data } = encode("https://ishortn.ink/dashboard", { ecc: "H", border: 0 });
    const dark = data.flat().filter(Boolean).length;
    for (const style of STYLES) {
      expect(buildQRPath(data, style).match(/M/g)?.length).toBe(dark);
    }
    expect(buildQRPath(data, "squircle").length).toBeLessThan(8000);
  });
});
