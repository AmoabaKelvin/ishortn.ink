export type QRStyle = "square" | "rounded" | "dot" | "squircle";

// Every module is a 0.9×0.9 shape inset 0.05 into its cell, drawn as one subpath so the whole code
// is a single <path>. Rounded and circular modules are stroked (with round caps and joins) rather
// than filled with arcs: a square of side 0.9 - 2r stroked 2r wide is exactly a 0.9 rounded rect
// with corner radius r, and a zero-length segment stroked 0.9 wide is a circle of radius 0.45. That
// keeps each subpath to a few characters, which matters because the default style's path ships in
// the homepage HTML. Coordinates are built as `${x}.05` so they never pick up float noise.
const STYLE_GEOMETRY = {
  // strokeWidth 0: filled square, no stroke.
  square: { subpath: (x, y) => `M${x}.05 ${y}.05h.9v.9h-.9z`, strokeWidth: 0 },
  rounded: { subpath: (x, y) => `M${x}.35 ${y}.35h.3v.3h-.3z`, strokeWidth: 0.6 },
  dot: { subpath: (x, y) => `M${x}.5 ${y}.5h0`, strokeWidth: 0.9 },
  // A squircle at this size (0.9 square, 0.45 corner radius) is a circle; it differs from dot only
  // in shape-rendering.
  squircle: { subpath: (x, y) => `M${x}.5 ${y}.5h0`, strokeWidth: 0.9 },
} satisfies Record<QRStyle, { subpath: (x: number, y: number) => string; strokeWidth: number }>;

export const qrStrokeWidth = (style: QRStyle) => STYLE_GEOMETRY[style].strokeWidth;

export const buildQRPath = (data: boolean[][], style: QRStyle): string => {
  const { subpath } = STYLE_GEOMETRY[style];
  let d = "";
  data.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) d += subpath(x, y);
    });
  });
  return d;
};
