import type { QrCodeGenerateResult } from "uqr";

export const PixelStyles = ["square", "rounded", "dot", "squircle", "row", "column"] as const;

export const MarkerFrames = [
  "square",
  "circle",
  "plus",
  "box",
  "octagon",
  "random",
  "tiny-plus",
] as const;

export const MarkerSubFrames = ["square", "circle", "box", "random", "plus"] as const;

export const MarkerCenters = ["square", "circle", "plus", "diamond", "eye"] as const;

export const QRMarkerCenters = ["auto", ...MarkerCenters] as const;

export const QREffects = ["none", "crystalize", "liquidify"] as const;

export type PixelStyle = (typeof PixelStyles)[number];
export type MarkerFrame = (typeof MarkerFrames)[number];
export type MarkerCenter = (typeof MarkerCenters)[number];

export interface GeneratedQRInfo {
  width: number;
  height: number;
}

export interface QrCodeGeneratorMarkerState {
  markerStyle: PixelStyle | "auto";
  markerFrame: MarkerFrame;
  markerCenter: MarkerCenter | "auto";
}

export type QRErrorCorrectionLevel = "L" | "M" | "Q" | "H";

export type QRPixelStyle = PixelStyle;

export type QRMarkerFrame = MarkerFrame;

export type QRMarkerCenter = (typeof QRMarkerCenters)[number];

export type QRMarginNoiseSpace = "none" | "marker" | "full" | "minimal" | "extreme";

export type QREffect = (typeof QREffects)[number];

export type QREffectTiming = "before" | "after";

export interface QRCodeGeneratorState extends QrCodeGeneratorMarkerState {
  text: string;
  ecc: QRErrorCorrectionLevel;
  margin: number;
  scale: number;
  seed: number;
  lightColor: string;
  darkColor: string;
  maskPattern: number;
  boostECC: boolean;
  minVersion: number;
  maxVersion: number;
  pixelStyle: QRPixelStyle;
  markers: QrCodeGeneratorMarkerState[];
  markerSub: MarkerFrame;
  marginNoise: boolean;
  marginNoiseRate: number;
  marginNoiseSpace: QRMarginNoiseSpace;
  marginNoiseOpacity: number;
  renderPointsType: "all" | "data" | "function" | "guide" | "marker";
  invert: boolean;
  rotate: 0 | 90 | 180 | 270;
  effect: QREffect;
  effectTiming: QREffectTiming;
  effectCrystalizeRadius: number;
  effectLiquidifyDistortRadius: number;
  effectLiquidifyRadius: number;
  effectLiquidifyThreshold: number;
  backgroundImage?: string;
  transparent: boolean;

  transformPerspectiveX: number;
  transformPerspectiveY: number;
  transformScale: number;

  // Logo embedding options
  logoImage?: string;
  logoSize: number; // Percentage of QR code size (10-30)
  logoMargin: number; // Padding around the logo in pixels
  logoBorderRadius: number; // Border radius percentage (0-50 for circle)
}

export interface QRCodeGenerateResult {
  qrcode: QrCodeGenerateResult;
  info: {
    width: number;
    height: number;
  };
}

import type { QrCodeGenerateResult as UQRGenerateResult } from "uqr";

// Result from our generate function
export interface GenerateQRCodeResult {
  qrcode: UQRGenerateResult;
  info: {
    width: number;
    height: number;
  };
}
