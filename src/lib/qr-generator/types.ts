import type { QrCodeGenerateResult } from "uqr";

export const PixelStyles = [
  'square',
  'rounded',
  'dot',
  'squircle',
  'row',
  'column',
] as const

export const MarkerShapes = [
  'square',
  'circle',
  'plus',
  'box',
  'octagon',
  'random',
  'tiny-plus',
] as const

export const MarkerInnerShapes = [
  'square',
  'circle',
  'plus',
  'diamond',
  'eye',
] as const

export type PixelStyle = typeof PixelStyles[number]
export type MarkerShape = typeof MarkerShapes[number]
export type MarkerInnerShape = typeof MarkerInnerShapes[number]

export interface MarginObject {
  top: number
  right: number
  bottom: number
  left: number
}

export interface QrCodeGeneratorMarkerState {
  markerStyle: PixelStyle | 'auto'
  markerShape: MarkerShape
  markerInnerShape: MarkerInnerShape | 'auto'
}

export type QRErrorCorrectionLevel = "L" | "M" | "Q" | "H"

export type QRPixelStyle = "square" | "rounded" | "dot" | "squircle" | "row" | "column"

export type QRMarkerShape = "square" | "circle" | "plus" | "box" | "octagon" | "random" | "tiny-plus"

export type QRMarkerInnerShape = "auto" | "square" | "circle" | "plus" | "diamond" | "eye"

export type QRMarginNoiseSpace = "none" | "marker" | "full" | "minimal" | "extreme"

export type QREffect = "none" | "crystalize" | "liquidify"

export type QREffectTiming = "before" | "after"

export interface QRCodeGeneratorState extends QrCodeGeneratorMarkerState {
  text: string
  ecc: QRErrorCorrectionLevel
  margin: number | MarginObject
  scale: number
  seed: number
  lightColor: string
  darkColor: string
  maskPattern: number
  boostECC: boolean
  minVersion: number
  maxVersion: number
  pixelStyle: QRPixelStyle
  markers: QrCodeGeneratorMarkerState[]
  markerSub: MarkerShape
  marginNoise: boolean
  marginNoiseRate: number
  marginNoiseSpace: QRMarginNoiseSpace
  marginNoiseOpacity: number | [number, number]
  renderPointsType: 'all' | 'data' | 'function' | 'guide' | 'marker'
  invert: boolean
  rotate: 0 | 90 | 180 | 270
  effect: QREffect
  effectTiming: QREffectTiming
  effectCrystalizeRadius: number
  effectLiquidifyDistortRadius: number
  effectLiquidifyRadius: number
  effectLiquidifyThreshold: number
  backgroundImage?: string
  transparent: boolean

  transformPerspectiveX: number
  transformPerspectiveY: number
  transformScale: number
}

export interface QRCodeGenerateResult {
  qrcode: QrCodeGenerateResult;
  info: {
    width: number;
    height: number;
  };
}

import type { QrCodeGenerateResult as UQRGenerateResult } from 'uqr';

// Result from our generate function
export interface GenerateQRCodeResult {
  qrcode: UQRGenerateResult;
  info: {
    width: number;
    height: number;
  };
}
