import { describe, expect, test } from "bun:test";

import { createQrPdf, pdfLabelText, svgPathToPdf } from "./pdf";
import { defaultGeneratorState } from "./state";

import type { QRCodeGeneratorState } from "./types";

const state = (extra: Partial<QRCodeGeneratorState> = {}): QRCodeGeneratorState => ({
  ...defaultGeneratorState(),
  seed: 7,
  text: "https://ishortn.ink/spring-sale",
  ...extra,
});

const decode = (pdf: Uint8Array) => new TextDecoder("latin1").decode(pdf);

function mediaBox(pdf: Uint8Array) {
  const match = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(decode(pdf));
  return match ? [Number(match[1]), Number(match[2])] : null;
}

describe("createQrPdf", () => {
  test.each([20, 30, 50, 72.5])("the page is the chosen size (%d mm)", (sizeMm) => {
    const [width, height] = mediaBox(createQrPdf(state(), { sizeMm }))!;
    const points = (sizeMm * 72) / 25.4;
    expect(width).toBeCloseTo(points, 3);
    expect(height).toBeCloseTo(points, 3);
  });

  test("draws the code as filled vector paths with no image", () => {
    const pdf = decode(createQrPdf(state({ pixelStyle: "rounded" }), { sizeMm: 30 }));
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain(" c\n"); // rounded corners become Bezier curves
    expect(pdf).not.toContain("/Subtype /Image");
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  test("the xref table points at every object", () => {
    const pdf = decode(createQrPdf(state(), { sizeMm: 30, frame: { label: "Scan me" } }));
    const startxref = Number(/startxref\n(\d+)/.exec(pdf)![1]);
    expect(pdf.slice(startxref, startxref + 4)).toBe("xref");
    const entries = [...pdf.slice(startxref).matchAll(/(\d{10}) 00000 n /g)];
    expect(entries.length).toBeGreaterThan(0);
    entries.forEach((entry, index) => {
      const offset = Number(entry[1]);
      expect(pdf.slice(offset, offset + `${index + 1} 0 obj`.length)).toBe(`${index + 1} 0 obj`);
    });
  });

  test("a frame adds the border and label band around the code at its size", () => {
    const sizeMm = 50;
    const [width, height] = mediaBox(
      createQrPdf(state(), { sizeMm, frame: { label: "Scan me" } }),
    )!;
    const side = (sizeMm * 72) / 25.4;
    expect(width).toBeCloseTo(side * 1.12, 2);
    expect(height).toBeCloseTo(side * 1.26, 2);
    const pdf = decode(createQrPdf(state(), { sizeMm, frame: { label: "Scan me" } }));
    expect(pdf).toContain("(Scan me) Tj");
    expect(pdf).toContain("/BaseFont /Helvetica-Bold");
  });

  test("escapes the label for a PDF string", () => {
    const pdf = decode(createQrPdf(state(), { sizeMm: 30, frame: { label: "Menu (café)" } }));
    expect(pdf).toContain("(Menu \\(caf\\351\\)) Tj");
  });

  test("embeds a logo as a JPEG image", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const pdf = decode(
      createQrPdf(state({ logoImage: "data:image/png;base64,AAAA", ecc: "H" }), {
        sizeMm: 30,
        logoJpeg: { data: jpeg, width: 1, height: 1 },
      }),
    );
    expect(pdf).toContain("/Filter /DCTDecode");
    expect(pdf).toContain("/Im1 Do");
  });
});

describe("pdfLabelText", () => {
  test("keeps Latin-1 text and drops what Helvetica can't print", () => {
    expect(pdfLabelText("  Scan   me 👋 ")).toBe("Scan me");
    expect(pdfLabelText("Menú")).toBe("Menú");
    expect(pdfLabelText("扫一扫")).toBe("");
  });

  test("caps the length", () => {
    expect(pdfLabelText("a".repeat(100))).toHaveLength(24);
  });
});

describe("svgPathToPdf", () => {
  test("converts absolute and relative lines and closes subpaths", () => {
    expect(svgPathToPdf("M1 2h3v1h-3z")).toBe("1 2 m\n4 2 l\n4 3 l\n1 3 l\nh\n");
  });

  test("a full circle from two arcs ends where it started", () => {
    const ops = svgPathToPdf("M0 .5a.5 .5 0 1 1 1 0a.5 .5 0 1 1 -1 0z").trim().split("\n");
    const curves = ops.filter((op) => op.endsWith(" c"));
    expect(curves.length).toBe(4);
    expect(curves.at(-1)!.split(" ").slice(4, 6)).toEqual(["0", "0.5"]);
  });

  test("a quarter-circle corner keeps its endpoint", () => {
    const ops = svgPathToPdf("M.5 0a.5 .5 0 0 1 .5 .5");
    expect(ops.trim().split("\n").at(-1)).toMatch(/ 1 0\.5 c$/);
  });
});
