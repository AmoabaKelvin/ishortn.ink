import { computePixels, createQrInstance, pointToLineProjection, seededRandom } from "./pixels";

import type { PixelInfo } from "./pixels";
import type { QRCodeGeneratorState } from "./types";

type Point = readonly [number, number];

// Cell corners in the canvas renderer's order: top-left, bottom-left, top-right, bottom-right.
const TL = 0;
const BL = 1;
const TR = 2;
const BR = 3;

/** Options the SVG can't reproduce; the SVG draws the same code without them. */
export function hasRasterOnlyOptions(state: QRCodeGeneratorState) {
  return (
    state.effect !== "none" ||
    state.transformPerspectiveX !== 0 ||
    state.transformPerspectiveY !== 0 ||
    state.transformScale !== 1 ||
    Boolean(state.backgroundImage)
  );
}

function num(value: number) {
  return String(Number(value.toFixed(3)));
}

function escapeAttr(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Vector version of `generateQRCode`, in module units (one module = 1). It reads the same pixel
 * data as the canvas renderer and redraws its shapes: dark ones go into one path (non-zero fill,
 * holes wound counter-clockwise), and light ones are skipped because they only ever paint over
 * the light background. `state.logoImage` is embedded as given, so pass a data URI.
 */
export function generateQRCodeSvg(state: QRCodeGeneratorState): string {
  const { size, background, foreground, d, fadedD, logo } = buildQrVector(state);
  const width = size * state.scale;

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${size} ${size}" width="${width}" height="${width}">`,
  ];
  if (background) {
    parts.push(`<rect width="${size}" height="${size}" fill="${escapeAttr(background)}"/>`);
  }
  if (foreground) {
    if (d) parts.push(`<path fill="${escapeAttr(foreground)}" d="${d}"/>`);
    if (fadedD) {
      parts.push(
        `<path fill="${escapeAttr(foreground)}" fill-opacity="${num(state.marginNoiseOpacity)}" d="${fadedD}"/>`,
      );
    }
  }

  if (state.logoImage && logo) {
    const { backdrop, offset } = logo;
    parts.push(
      `<rect x="${num(backdrop.x)}" y="${num(backdrop.x)}" width="${num(backdrop.size)}" height="${num(backdrop.size)}" rx="${num(backdrop.radius)}" fill="${escapeAttr(state.lightColor)}"/>`,
      `<clipPath id="qr-logo-clip"><rect x="${num(offset.x)}" y="${num(offset.x)}" width="${num(offset.size)}" height="${num(offset.size)}" rx="${num(offset.radius)}"/></clipPath>`,
      `<image x="${num(offset.x)}" y="${num(offset.x)}" width="${num(offset.size)}" height="${num(offset.size)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#qr-logo-clip)" xlink:href="${escapeAttr(state.logoImage)}"/>`,
    );
  }

  parts.push("</svg>");
  return parts.join("\n");
}

type Square = { x: number; size: number; radius: number };

export type QrVector = {
  /** Side of the square drawing in modules, margin included. */
  size: number;
  background: string | null;
  foreground: string | null;
  /** Dark shapes as SVG path data in module units (non-zero fill). */
  d: string;
  /** Margin-noise shapes drawn at `marginNoiseOpacity`. */
  fadedD: string;
  /** Where a logo goes (x = y, the logo is centred): its light backdrop and its clipped image. */
  logo: { backdrop: Square; offset: Square } | null;
};

/** The vector shapes shared by the SVG and PDF exports. */
export function buildQrVector(state: QRCodeGeneratorState): QrVector {
  const qr = createQrInstance(state);
  const { margin, seed, pixelStyle, markerSub, invert, renderPointsType } = state;
  const size = qr.size + margin * 2;

  const pixels = computePixels(qr, state);
  const byPosition = new Map<string, PixelInfo>();
  for (const pixel of pixels) {
    const key = `${pixel.x},${pixel.y}`;
    if (!byPosition.has(key)) byPosition.set(key, pixel);
  }

  const subpaths: string[] = [];
  const fadedSubpaths: string[] = [];
  // Square cells are merged into horizontal runs once every cell is known.
  const squares = new Set<string>();
  const fadedSquares = new Set<string>();

  // The canvas fills a square corner with an arc of radius `halfcell + 2` px. At download scale
  // that differs from an exact corner by under 0.3% of a module, so corners are drawn either
  // exactly square or as quarter circles.
  function cell(x: number, y: number, square: readonly boolean[]) {
    const round = (dx: number, dy: number) => `a.5 .5 0 0 1 ${num(dx)} ${num(dy)}`;
    return (
      `M${num(x + 0.5)} ${num(y)}` +
      (square[TR] ? "h.5v.5" : round(0.5, 0.5)) +
      (square[BR] ? "v.5h-.5" : round(-0.5, 0.5)) +
      (square[BL] ? "h-.5v-.5" : round(-0.5, -0.5)) +
      (square[TL] ? "v-.5h.5" : round(0.5, -0.5)) +
      "z"
    );
  }

  // The dark part of a light cell's corner: the corner square minus the cell's light dot.
  function innerCorner(x: number, y: number, index: number) {
    const arc = "a.5 .5 0 0 0";
    if (index === TL) return `M${num(x)} ${num(y)}h.5${arc} -.5 .5z`;
    if (index === TR) return `M${num(x + 1)} ${num(y)}v.5${arc} -.5 -.5z`;
    if (index === BR) return `M${num(x + 1)} ${num(y + 1)}h-.5${arc} .5 -.5z`;
    return `M${num(x)} ${num(y + 1)}v-.5${arc} .5 .5z`;
  }

  function circle(cX: number, cY: number, r: number, clockwise = true) {
    const sweep = clockwise ? 1 : 0;
    const arc = `a${num(r)} ${num(r)} 0 1 ${sweep}`;
    return `M${num(cX - r)} ${num(cY)}${arc} ${num(2 * r)} 0${arc} ${num(-2 * r)} 0z`;
  }

  // Equivalent of CanvasRenderingContext2D.arcTo from `from` (the current point).
  function arcTo(from: Point, corner: Point, to: Point, r: number) {
    const v1: Point = [from[0] - corner[0], from[1] - corner[1]];
    const v2: Point = [to[0] - corner[0], to[1] - corner[1]];
    const l1 = Math.hypot(...v1);
    const l2 = Math.hypot(...v2);
    const angle = Math.acos((v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2));
    const d = r / Math.tan(angle / 2);
    const t1: Point = [corner[0] + (v1[0] / l1) * d, corner[1] + (v1[1] / l1) * d];
    const t2: Point = [corner[0] + (v2[0] / l2) * d, corner[1] + (v2[1] / l2) * d];
    const cross =
      (corner[0] - from[0]) * (to[1] - corner[1]) - (corner[1] - from[1]) * (to[0] - corner[0]);
    const sweep = cross > 0 ? 1 : 0;
    return `L${num(t1[0])} ${num(t1[1])}A${num(r)} ${num(r)} 0 0 ${sweep} ${num(t2[0])} ${num(t2[1])}`;
  }

  function octagonPoints(dx: number, dy: number): Point[] {
    return [
      [dx, dy],
      [-dx, dy],
      [-dy, dx],
      [-dy, -dx],
      [-dx, -dy],
      [dx, -dy],
      [dy, -dx],
      [dy, dx],
    ];
  }

  function octagon(cX: number, cY: number, radius: number, rounded: boolean, clockwise: boolean) {
    const order = (points: Point[]) => (clockwise ? points : points.reverse());
    const points = order(octagonPoints((1.5 / 3.5) * radius, radius)).map(([x, y]): Point => [
      cX + x,
      cY + y,
    ]);
    if (!rounded) {
      return `${points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${num(x)} ${num(y)}`).join("")}z`;
    }
    const inner = order(octagonPoints((1.5 / 3.5) * (radius - 1), radius - 1)).map(
      ([x, y]): Point => [cX + x, cY + y],
    );
    let d = "";
    points.forEach((corner, i) => {
      const previous = points[(i + points.length - 1) % points.length]!;
      const next = points[(i + 1) % points.length]!;
      const p1 = pointToLineProjection(...inner[i]!, ...previous, ...corner);
      const p2 = pointToLineProjection(...inner[i]!, ...next, ...corner);
      d += `${i === 0 ? "M" : "L"}${num(p1[0])} ${num(p1[1])}${arcTo(p1, corner, p2, 1)}`;
      d += `L${num(p2[0])} ${num(p2[1])}`;
    });
    return `${d}z`;
  }

  function eye(cX: number, cY: number) {
    const top: Point = [cX, cY - 1.5];
    const bottom: Point = [cX, cY + 1.5];
    return (
      `M${num(top[0])} ${num(top[1])}` +
      arcTo(top, [cX + 1.5, cY], bottom, 1) +
      `L${num(bottom[0])} ${num(bottom[1])}` +
      arcTo(bottom, [cX - 1.5, cY], top, 1) +
      "z"
    );
  }

  function diamond(cX: number, cY: number) {
    return `M${num(cX)} ${num(cY - 1.5)}L${num(cX + 1.5)} ${num(cY)}L${num(cX)} ${num(cY + 1.5)}L${num(cX - 1.5)} ${num(cY)}z`;
  }

  function isConnected(x: number, y: number) {
    const pixel = byPosition.get(`${x},${y}`);
    if (!pixel) return true;
    if (pixel.isIgnored || (pixel.isBorder && !pixel.isDark)) return null;
    return pixel.isDark;
  }

  for (const { isDark, marker, x, y, isBorder, isIgnored } of pixels) {
    if (isIgnored) continue;

    const faded = isBorder && state.marginNoiseOpacity !== 1;
    const out = faded ? fadedSubpaths : subpaths;
    let style = pixelStyle;
    const cX = x + 0.5;
    const cY = y + 0.5;

    if (marker && marker.position !== "sub") {
      style = marker.style.markerStyle === "auto" ? pixelStyle : marker.style.markerStyle;
      if (renderPointsType === "data") continue;

      const { markerFrame, markerCenter } = marker.style;
      if (markerFrame === "circle") {
        if (marker.isBorder) continue;
        if (marker.isCenter) out.push(circle(cX, cY, 3.5), circle(cX, cY, 2.5, false));
      } else if (markerFrame === "octagon") {
        if (marker.isBorder) continue;
        if (marker.isCenter) {
          const rounded = style === "rounded";
          out.push(octagon(cX, cY, 3.5, rounded, true), octagon(cX, cY, 2.5, rounded, false));
        }
      }

      if (marker.isInner) {
        if (markerCenter === "circle") {
          if (marker.isCenter) out.push(circle(cX, cY, 1.5));
          continue;
        } else if (markerCenter === "eye") {
          if (marker.isCenter) out.push(eye(cX, cY));
          continue;
        } else if (markerCenter === "diamond") {
          if (marker.isCenter) out.push(diamond(cX, cY));
          continue;
        }
      }
    }

    if (marker?.position === "sub") {
      if (renderPointsType === "data") continue;
      if (markerSub === "circle") {
        if (marker.isBorder) continue;
        if (marker.isCenter) out.push(circle(cX, cY, 2.5), circle(cX, cY, 1.5, false));
      }
    }

    if (style === "dot") {
      if (isDark) out.push(circle(cX, cY, 0.5));
    } else if (style === "squircle") {
      if (isDark) {
        const square = [0, 1, 2, 3].map((i) => seededRandom(seed, x, y, `squircle-${i}`) < 0.5);
        out.push(cell(x, y, square));
      }
    } else if (style === "rounded" || style === "row" || style === "column") {
      const top = isConnected(x, y - 1);
      const bottom = isConnected(x, y + 1);
      const left = isConnected(x - 1, y);
      const right = isConnected(x + 1, y);

      if (isDark) {
        // Mirrors the canvas renderer: a corner is square when it connects to a neighbour.
        const square = [false, false, false, false];
        if (style !== "row") {
          square[TL] ||= top === true;
          square[TR] ||= top === true;
          square[BL] ||= bottom === true;
          square[BR] ||= bottom === true;
        }
        if (style !== "column") {
          square[TL] ||= left === true;
          square[BL] ||= left === true;
          square[TR] ||= right === true;
          square[BR] ||= right === true;
        }
        if (style === "rounded") {
          if ((top == null) !== (left == null)) square[TL] = true;
          if ((top == null) !== (right == null)) square[TR] = true;
          if ((bottom == null) !== (left == null)) square[BL] = true;
          if ((bottom == null) !== (right == null)) square[BR] = true;
        }
        out.push(cell(x, y, square));
      } else if (style === "rounded" && !isBorder) {
        const topLeft = isConnected(x - 1, y - 1);
        const topRight = isConnected(x + 1, y - 1);
        const bottomLeft = isConnected(x - 1, y + 1);
        const bottomRight = isConnected(x + 1, y + 1);
        if (top && left && topLeft) out.push(innerCorner(x, y, TL));
        if (top && right && topRight) out.push(innerCorner(x, y, TR));
        if (bottom && left && bottomLeft) out.push(innerCorner(x, y, BL));
        if (bottom && right && bottomRight) out.push(innerCorner(x, y, BR));
      }
    } else if (isDark) {
      (faded ? fadedSquares : squares).add(`${x},${y}`);
    }
  }

  function squareRuns(cells: Set<string>) {
    let d = "";
    for (let y = -1; y <= size; y++) {
      let x = -1;
      while (x <= size) {
        if (!cells.has(`${x},${y}`)) {
          x++;
          continue;
        }
        const start = x;
        while (cells.has(`${x},${y}`)) x++;
        d += `M${start} ${y}h${x - start}v1h${start - x}z`;
      }
    }
    return d;
  }

  const lightColor = state.transparent ? null : state.lightColor;
  const background = invert ? state.darkColor : lightColor;
  const foreground = invert ? lightColor : state.darkColor;

  let logo: QrVector["logo"] = null;
  if (state.logoImage) {
    // Same geometry as drawLogo in generate.ts; logoMargin is in output pixels.
    const logoSize = (size * state.logoSize) / 100;
    const total = logoSize + (state.logoMargin / state.scale) * 2;
    logo = {
      backdrop: {
        x: (size - total) / 2,
        size: total,
        radius: (total * state.logoBorderRadius) / 100,
      },
      offset: {
        x: (size - logoSize) / 2,
        size: logoSize,
        radius: (logoSize * state.logoBorderRadius) / 100,
      },
    };
  }

  return {
    size,
    background,
    foreground,
    d: squareRuns(squares) + subpaths.join(""),
    fadedD: squareRuns(fadedSquares) + fadedSubpaths.join(""),
    logo,
  };
}

/** Reads an image (data URI or CORS-enabled URL) into a data URI so the SVG is self-contained. */
export async function toDataUri(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  const response = await fetch(src);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read image"));
    reader.readAsDataURL(blob);
  });
}

const MAX_LOGO_EDGE = 1024;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/**
 * Reads a logo into a PNG or JPEG data URI, the formats a code's saved style accepts. Other
 * formats (GIF, WebP, SVG, …) are redrawn on a canvas and exported as PNG, at most 1024px on
 * the long edge and halved until the file fits the 2MB style limit.
 */
export async function toLogoDataUri(src: string): Promise<string> {
  const dataUri = await toDataUri(src);
  if (/^data:image\/(png|jpe?g);base64,/.test(dataUri)) return dataUri;

  const img = new Image();
  img.src = dataUri;
  await img.decode();
  // SVGs without width/height report a natural size of 0.
  const width = img.naturalWidth || 512;
  const height = img.naturalHeight || 512;
  let scale = Math.min(1, MAX_LOGO_EDGE / Math.max(width, height));
  for (;;) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const png = canvas.toDataURL("image/png");
    // Base64 is 4/3 of the decoded size.
    if (png.length * 0.75 <= MAX_LOGO_BYTES || Math.max(canvas.width, canvas.height) <= 64)
      return png;
    scale /= 2;
  }
}
