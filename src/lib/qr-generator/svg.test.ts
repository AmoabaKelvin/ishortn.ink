import { describe, expect, test } from "bun:test";

import { encode } from "uqr";

import { computePixels, createQrInstance } from "./pixels";
import { defaultGeneratorState } from "./state";
import { generateQRCodeSvg, hasRasterOnlyOptions } from "./svg";
import { MarkerCenters, MarkerFrames, PixelStyles } from "./types";

import type { QRCodeGeneratorState } from "./types";

const TEXT = "https://ishortn.ink/abc123";

function stateFor(overrides: Partial<QRCodeGeneratorState> = {}): QRCodeGeneratorState {
  return { ...defaultGeneratorState(), seed: 42, text: TEXT, scale: 20, ...overrides };
}

function pathData(svg: string) {
  return [...svg.matchAll(/<path [^>]*d="([^"]*)"/g)].map((m) => m[1]!);
}

// Square-style output is one `M{x} {y}h{n}v1h-{n}z` run per stretch of dark modules.
function decodeSquareRuns(d: string, size: number) {
  const grid = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  for (const [, x, y, n] of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    for (let i = 0; i < Number(n); i++) grid[Number(y)]![Number(x) + i] = true;
  }
  return grid;
}

describe("generateQRCodeSvg", () => {
  test("square style encodes the same matrix as uqr and the canvas renderer", () => {
    const state = stateFor({ pixelStyle: "square" });
    const svg = generateQRCodeSvg(state);

    const qr = encode(TEXT, { ecc: "M", border: 0 });
    const size = qr.size + state.margin * 2;
    expect(qr.size).toBe(25);
    expect(svg).toContain(`viewBox="0 0 ${size} ${size}"`);
    expect(svg).toContain(`width="${size * 20}" height="${size * 20}"`);

    const paths = pathData(svg);
    expect(paths).toHaveLength(1);
    const grid = decodeSquareRuns(paths[0]!, size);

    const expected = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
    qr.data.forEach((row, y) =>
      row.forEach((dark, x) => {
        expected[y + state.margin]![x + state.margin] = dark;
      }),
    );
    expect(grid).toEqual(expected);

    // The PNG path draws from computePixels; the SVG must draw exactly its dark modules.
    const canvasPixels = computePixels(createQrInstance(state), state);
    const darkCount = canvasPixels.filter((p) => p.isDark && !p.isIgnored).length;
    expect(darkCount).toBe(qr.data.flat().filter(Boolean).length);
    expect(grid.flat().filter(Boolean).length).toBe(darkCount);
    for (const pixel of canvasPixels) expect(grid[pixel.y]![pixel.x]).toBe(pixel.isDark);
  });

  test("draws each colour once: a background rect and a single dark path", () => {
    for (const pixelStyle of PixelStyles) {
      for (const markerFrame of MarkerFrames) {
        for (const markerCenter of MarkerCenters) {
          const svg = generateQRCodeSvg(stateFor({ pixelStyle, markerFrame, markerCenter }));
          expect(svg.match(/<rect /g)).toHaveLength(1);
          expect(pathData(svg)).toHaveLength(1);
          expect(svg).not.toContain("NaN");
          expect(svg).not.toContain("Infinity");
        }
      }
    }
    // Renders every style combination (~3s alone); the default 5s times out on a busy runner.
  }, 20_000);

  test("dot style draws one circle per dark module", () => {
    const state = stateFor({ pixelStyle: "dot" });
    const d = pathData(generateQRCodeSvg(state))[0]!;
    const qr = encode(TEXT, { ecc: "M", border: 0 });
    const dark = qr.data.flat().filter(Boolean).length;
    // Finder markers use the square frame and "auto" centre, which follow the pixel style.
    expect(d.match(/M/g)).toHaveLength(dark);
  });

  test("uses the configured colours and escapes them", () => {
    const svg = generateQRCodeSvg(stateFor({ darkColor: "#1d4ed8", lightColor: '#fff"/>' }));
    expect(svg).toContain('<rect width="29" height="29" fill="#fff&quot;/&gt;"/>');
    expect(svg).toContain('<path fill="#1d4ed8"');
  });

  test("embeds the logo at the PNG's size, padding and radius with error correction H", () => {
    const logo = "data:image/png;base64,iVBORw0KGgo=";
    const state = stateFor({ logoImage: logo, logoSize: 20, logoMargin: 4, logoBorderRadius: 50 });
    const svg = generateQRCodeSvg(state);

    const size = encode(TEXT, { ecc: "H", border: 0 }).size + state.margin * 2;
    expect(svg).toContain(`viewBox="0 0 ${size} ${size}"`);
    const n = (value: number) => String(Number(value.toFixed(3)));
    const logoSize = (size * 20) / 100;
    const total = logoSize + (4 / 20) * 2;
    expect(svg).toContain(
      `<rect x="${n((size - total) / 2)}" y="${n((size - total) / 2)}" width="${n(total)}" height="${n(total)}" rx="${n(total / 2)}" fill="#ffffff"/>`,
    );
    expect(svg).toContain(`width="${n(logoSize)}" height="${n(logoSize)}" rx="${n(logoSize / 2)}"`);
    expect(svg).toContain(`xlink:href="${logo}"`);
  });
});

describe("hasRasterOnlyOptions", () => {
  test("flags effects and perspective only", () => {
    expect(hasRasterOnlyOptions(stateFor())).toBe(false);
    expect(hasRasterOnlyOptions(stateFor({ marginNoise: true }))).toBe(false);
    expect(hasRasterOnlyOptions(stateFor({ effect: "crystalize" }))).toBe(true);
    expect(hasRasterOnlyOptions(stateFor({ effect: "liquidify" }))).toBe(true);
    expect(hasRasterOnlyOptions(stateFor({ transformPerspectiveX: 0.2 }))).toBe(true);
  });
});
