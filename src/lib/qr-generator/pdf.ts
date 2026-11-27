import { buildQrVector } from "./svg";

import type { QRCodeGeneratorState } from "./types";

export const PDF_SIZE_PRESETS_CM = [2, 3, 5] as const;
export const PDF_MIN_SIZE_CM = 1;
export const PDF_MAX_SIZE_CM = 50;
export const PDF_LABEL_MAX_LENGTH = 24;

const POINTS_PER_MM = 72 / 25.4;
// Bezier handle length for a quarter circle.
const KAPPA = 0.5522847498;

export type QrPdfOptions = {
  /** Side of the code, quiet zone included. A frame adds its border and label band around it. */
  sizeMm: number;
  frame?: { label: string } | null;
  /** The logo pre-rendered as a square JPEG over the light colour (PDF embeds JPEG as is). */
  logoJpeg?: { data: Uint8Array; width: number; height: number } | null;
};

// Helvetica-Bold advance widths for U+0020..U+007E (from the standard AFM), in 1/1000 em.
// prettier-ignore
const HELVETICA_BOLD_WIDTHS = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];
const HELVETICA_BOLD_CAP_HEIGHT = 0.718;

/**
 * The label as the standard Helvetica font can print it without embedding a font: characters
 * outside Latin-1 (WinAnsi) are dropped, whitespace is collapsed and the length is capped.
 */
export function pdfLabelText(label: string) {
  return label
    .normalize("NFC")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, PDF_LABEL_MAX_LENGTH);
}

function labelWidthEm(text: string) {
  let width = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    width += (code >= 0x20 && code <= 0x7e ? HELVETICA_BOLD_WIDTHS[code - 0x20] : 556) ?? 556;
  }
  return width / 1000;
}

function pdfString(text: string) {
  let out = "";
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (char === "(" || char === ")" || char === "\\") out += `\\${char}`;
    else if (code > 0x7e) out += `\\${code.toString(8).padStart(3, "0")}`;
    else out += char;
  }
  return `(${out})`;
}

function n(value: number) {
  return String(Number(value.toFixed(4)));
}

function rgb(hex: string) {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex);
  if (!match) return "0 0 0";
  return match
    .slice(1, 4)
    .map((part) => n(parseInt(part, 16) / 255))
    .join(" ");
}

function roundedRect(x: number, y: number, w: number, h: number, radius: number) {
  const r = Math.min(radius, w / 2, h / 2);
  if (r <= 0) return `${n(x)} ${n(y)} ${n(w)} ${n(h)} re\n`;
  const k = r * KAPPA;
  const right = x + w;
  const top = y + h;
  return [
    `${n(x + r)} ${n(y)} m`,
    `${n(right - r)} ${n(y)} l`,
    `${n(right - r + k)} ${n(y)} ${n(right)} ${n(y + r - k)} ${n(right)} ${n(y + r)} c`,
    `${n(right)} ${n(top - r)} l`,
    `${n(right)} ${n(top - r + k)} ${n(right - r + k)} ${n(top)} ${n(right - r)} ${n(top)} c`,
    `${n(x + r)} ${n(top)} l`,
    `${n(x + r - k)} ${n(top)} ${n(x)} ${n(top - r + k)} ${n(x)} ${n(top - r)} c`,
    `${n(x)} ${n(y + r)} l`,
    `${n(x)} ${n(y + r - k)} ${n(x + r - k)} ${n(y)} ${n(x + r)} ${n(y)} c`,
    "h\n",
  ].join("\n");
}

/** SVG elliptical arc (endpoint form) as cubic Beziers, per SVG 1.1 appendix F.6. */
function arcToCurves(
  x1: number,
  y1: number,
  rxIn: number,
  ryIn: number,
  rotationDeg: number,
  largeArc: boolean,
  sweep: boolean,
  x2: number,
  y2: number,
): string {
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0) return `${n(x2)} ${n(y2)} l\n`;
  if (x1 === x2 && y1 === y2) return "";

  const phi = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;

  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }

  const numerator = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const denominator = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const factor = (largeArc === sweep ? -1 : 1) * Math.sqrt(Math.max(0, numerator / denominator));
  const cxp = (factor * rx * y1p) / ry;
  const cyp = (-factor * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;

  const angle = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  else if (sweep && delta < 0) delta += 2 * Math.PI;

  const segments = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-9));
  const step = delta / segments;
  const t = (4 / 3) * Math.tan(step / 4);
  const point = (theta: number) => {
    const ex = rx * Math.cos(theta);
    const ey = ry * Math.sin(theta);
    return [cx + cos * ex - sin * ey, cy + sin * ex + cos * ey] as const;
  };
  const derivative = (theta: number) => {
    const ex = -rx * Math.sin(theta);
    const ey = ry * Math.cos(theta);
    return [cos * ex - sin * ey, sin * ex + cos * ey] as const;
  };

  let out = "";
  let theta = theta1;
  for (let i = 0; i < segments; i++) {
    const next = theta + step;
    const [px, py] = point(theta);
    const [qx, qy] = i === segments - 1 ? [x2, y2] : point(next);
    const [d1x, d1y] = derivative(theta);
    const [d2x, d2y] = derivative(next);
    out += `${n(px + t * d1x)} ${n(py + t * d1y)} ${n(qx - t * d2x)} ${n(qy - t * d2y)} ${n(qx)} ${n(qy)} c\n`;
    theta = next;
  }
  return out;
}

/**
 * SVG path data (the M/L/H/V/C/A/Z commands, absolute and relative, that `buildQrVector` emits)
 * as PDF path construction operators in the same coordinate space.
 */
export function svgPathToPdf(d: string): string {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  let i = 0;
  let command = "";
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let out = "";
  const next = () => Number(tokens[i++]);

  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i]!)) command = tokens[i++]!;
    const relative = command === command.toLowerCase();
    const ox = relative ? x : 0;
    const oy = relative ? y : 0;

    switch (command.toLowerCase()) {
      case "m": {
        x = ox + next();
        y = oy + next();
        startX = x;
        startY = y;
        out += `${n(x)} ${n(y)} m\n`;
        // Further coordinate pairs after a moveto are implicit linetos.
        command = relative ? "l" : "L";
        break;
      }
      case "l": {
        x = ox + next();
        y = oy + next();
        out += `${n(x)} ${n(y)} l\n`;
        break;
      }
      case "h": {
        x = ox + next();
        out += `${n(x)} ${n(y)} l\n`;
        break;
      }
      case "v": {
        y = oy + next();
        out += `${n(x)} ${n(y)} l\n`;
        break;
      }
      case "c": {
        const values = [next(), next(), next(), next(), next(), next()];
        const [c1x, c1y, c2x, c2y, ex, ey] = values.map((value, index) =>
          index % 2 === 0 ? ox + value : oy + value,
        );
        out += `${n(c1x!)} ${n(c1y!)} ${n(c2x!)} ${n(c2y!)} ${n(ex!)} ${n(ey!)} c\n`;
        x = ex!;
        y = ey!;
        break;
      }
      case "a": {
        const rx = next();
        const ry = next();
        const rotation = next();
        const largeArc = next() !== 0;
        const sweep = next() !== 0;
        const ex = ox + next();
        const ey = oy + next();
        out += arcToCurves(x, y, rx, ry, rotation, largeArc, sweep, ex, ey);
        x = ex;
        y = ey;
        break;
      }
      case "z": {
        out += "h\n";
        x = startX;
        y = startY;
        break;
      }
      default:
        throw new Error(`Unsupported SVG path command: ${command}`);
    }
  }
  return out;
}

/**
 * A one-page vector PDF of the code at its print size. The modules are filled paths, so the code
 * stays sharp at any size; only an embedded logo is a raster image. With a frame, the code sits on
 * a rounded dark card with the label in a band below it.
 */
export function createQrPdf(state: QRCodeGeneratorState, options: QrPdfOptions): Uint8Array {
  const vector = buildQrVector(state);
  const side = options.sizeMm * POINTS_PER_MM;
  const label = options.frame ? pdfLabelText(options.frame.label) : "";

  const pad = options.frame ? side * 0.06 : 0;
  const band = options.frame ? side * 0.2 : 0;
  const width = side + pad * 2;
  const height = side + pad + band;
  const qrX = pad;
  const qrY = band;

  const resources: string[] = [];
  let content = "";

  if (options.frame) {
    content += `${rgb(state.darkColor)} rg\n${roundedRect(0, 0, width, height, pad * 1.5)}f\n`;
    if (label) {
      const textWidth = labelWidthEm(label);
      const fontSize = Math.min(band * 0.45, (width - pad * 2) / textWidth);
      const textX = (width - textWidth * fontSize) / 2;
      const textY = (band - HELVETICA_BOLD_CAP_HEIGHT * fontSize) / 2;
      content += `BT\n${rgb(state.lightColor)} rg\n/F1 ${n(fontSize)} Tf\n${n(textX)} ${n(textY)} Td\n${pdfString(label)} Tj\nET\n`;
      resources.push("/Font << /F1 5 0 R >>");
    }
  }

  // Draw the code in SVG module units: flip y and scale modules to points.
  const unit = side / vector.size;
  content += `q\n${n(unit)} 0 0 ${n(-unit)} ${n(qrX)} ${n(qrY + side)} cm\n`;
  if (vector.background) {
    content += `${rgb(vector.background)} rg\n0 0 ${vector.size} ${vector.size} re\nf\n`;
  }
  if (vector.foreground) {
    if (vector.d) content += `${rgb(vector.foreground)} rg\n${svgPathToPdf(vector.d)}f\n`;
    if (vector.fadedD) {
      content += `q\n/GS1 gs\n${rgb(vector.foreground)} rg\n${svgPathToPdf(vector.fadedD)}f\nQ\n`;
      resources.push(
        `/ExtGState << /GS1 << /Type /ExtGState /ca ${n(state.marginNoiseOpacity)} >> >>`,
      );
    }
  }
  if (vector.logo && options.logoJpeg) {
    const { backdrop, offset } = vector.logo;
    content += `${rgb(state.lightColor)} rg\n${roundedRect(backdrop.x, backdrop.x, backdrop.size, backdrop.size, backdrop.radius)}f\n`;
    content += `q\n${roundedRect(offset.x, offset.x, offset.size, offset.size, offset.radius)}W n\n`;
    content += `${n(offset.size)} 0 0 ${n(-offset.size)} ${n(offset.x)} ${n(offset.x + offset.size)} cm\n/Im1 Do\nQ\n`;
    resources.push("/XObject << /Im1 6 0 R >>");
  }
  content += "Q\n";

  const encoder = new TextEncoder();
  const objects: Uint8Array[][] = [];
  const text = (value: string) => [encoder.encode(value)];
  objects[1] = text("<< /Type /Catalog /Pages 2 0 R >>");
  objects[2] = text("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objects[3] = text(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(width)} ${n(height)}] /Resources << ${resources.join(" ")} >> /Contents 4 0 R >>`,
  );
  const contentBytes = encoder.encode(content);
  objects[4] = [
    encoder.encode(`<< /Length ${contentBytes.length} >>\nstream\n`),
    contentBytes,
    encoder.encode("\nendstream"),
  ];
  objects[5] = text(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  );
  if (options.logoJpeg) {
    const { data, width: w, height: h } = options.logoJpeg;
    objects[6] = [
      encoder.encode(
        `<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${data.length} >>\nstream\n`,
      ),
      data,
      encoder.encode("\nendstream"),
    ];
  } else {
    objects[6] = text("null");
  }

  // The binary comment marks the file as binary for transfer tools.
  const chunks: Uint8Array[] = [encoder.encode("%PDF-1.4\n%âãÏÓ\n")];
  let length = chunks[0]!.length;
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = length;
    for (const part of [
      encoder.encode(`${id} 0 obj\n`),
      ...objects[id]!,
      encoder.encode("\nendobj\n"),
    ]) {
      chunks.push(part);
      length += part.length;
    }
  }
  const xref = [
    "xref",
    `0 ${objects.length}`,
    "0000000000 65535 f ",
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objects.length} /Root 1 0 R >>`,
    "startxref",
    String(length),
    "%%EOF\n",
  ].join("\n");
  chunks.push(encoder.encode(`${xref}`));

  const out = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let position = 0;
  for (const chunk of chunks) {
    out.set(chunk, position);
    position += chunk.length;
  }
  return out;
}
