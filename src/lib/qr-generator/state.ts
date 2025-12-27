import type { QrCodeGenerateResult } from 'uqr';
import type {
  GenerateQRCodeResult,
  QRCodeGeneratorState,
} from './types';

// Default states
export function defaultGeneratorState(): QRCodeGeneratorState {
  return {
    text: 'https://ishortn.ink',
    ecc: 'M',
    margin: 2,
    scale: 20,
    lightColor: '#ffffff',
    darkColor: '#000000',
    pixelStyle: 'rounded',
    markerStyle: 'auto',
    markerShape: 'square',
    markerInnerShape: 'auto',
    markerSub: 'square',
    markers: [],
    maskPattern: -1,
    minVersion: 1,
    maxVersion: 40,
    boostECC: false,
    rotate: 0,
    invert: false,
    marginNoise: false,
    marginNoiseRate: 0.5,
    marginNoiseOpacity: 1,
    seed: Math.round(Math.random() * 1000000),
    marginNoiseSpace: 'marker',
    renderPointsType: 'all',
    effect: 'none',
    effectTiming: 'after',
    effectCrystalizeRadius: 12,
    effectLiquidifyDistortRadius: 12,
    effectLiquidifyRadius: 12,
    effectLiquidifyThreshold: 128,
    transparent: false,
    transformPerspectiveX: 0,
    transformPerspectiveY: 0,
    transformScale: 1,
  };
}

export interface QRCodeContextState {
  state: QRCodeGeneratorState;
  qrcode: QrCodeGenerateResult | null;
  dataUrl: string | null;
  generatedInfo: {
    width: number;
    height: number;
  } | null;
}

export interface QRCodeContextValue extends QRCodeContextState {
  setState: (state: Partial<QRCodeGeneratorState>) => void;
  setQrcode: (result: GenerateQRCodeResult | null) => void;
  setDataUrl: (url: string | null) => void;
  setGeneratedInfo: (info: { width: number; height: number; } | null) => void;
  resetState: () => void;
}
