import type { CornerStyle, PatternStyle } from "@/lib/types/qrcode";
import type {
  QRPixelStyle,
  QRMarkerShape,
  QRMarkerInnerShape,
  QREffect,
} from "@/lib/qr-generator/types";

// Legacy pattern styles (for qrcode-with-logos compatibility)
export const patternStyles: PatternStyle[] = [
  "square",
  "diamond",
  "star",
  "fluid",
  "rounded",
  "tile",
  "stripe",
  "fluid-line",
  "stripe-column",
];

export const presetColors = [
  "#198639",
  "#34A853",
  "#E55934",
  "#2D2E33",
  "#000000",
  "#FFD600",
  "#FF585D",
];

// Legacy corner styles (for qrcode-with-logos compatibility)
export const cornerStyles: CornerStyle[] = [
  "circle",
  "circle-diamond",
  "square",
  "square-diamond",
  "rounded-circle",
  "rounded",
  "circle-star",
];

// New advanced QR code styles
export const pixelStyles: { value: QRPixelStyle; label: string }[] = [
  { value: "square", label: "Square" },
  { value: "rounded", label: "Rounded" },
  { value: "dot", label: "Dot" },
  { value: "squircle", label: "Squircle" },
  { value: "row", label: "Row" },
  { value: "column", label: "Column" },
];

export const markerShapes: { value: QRMarkerShape; label: string }[] = [
  { value: "square", label: "Square" },
  { value: "circle", label: "Circle" },
  { value: "plus", label: "Plus" },
  { value: "box", label: "Box" },
  { value: "octagon", label: "Octagon" },
  { value: "random", label: "Random" },
  { value: "tiny-plus", label: "Tiny Plus" },
];

export const markerInnerShapes: { value: QRMarkerInnerShape; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "square", label: "Square" },
  { value: "circle", label: "Circle" },
  { value: "plus", label: "Plus" },
  { value: "diamond", label: "Diamond" },
  { value: "eye", label: "Eye" },
];

export const qrEffects: { value: QREffect; label: string }[] = [
  { value: "none", label: "None" },
  { value: "crystalize", label: "Crystalize" },
  { value: "liquidify", label: "Liquidify" },
];
