"use client";

import { IconX } from "@tabler/icons-react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  pixelStyles,
  markerShapes,
  markerInnerShapes,
  qrEffects,
  presetColors,
  presetBackgroundColors,
} from "@/lib/constants/qrcode";
import type {
  QRPixelStyle,
  QRMarkerShape,
  QRMarkerInnerShape,
  QREffect,
} from "@/lib/qr-generator/types";

import { ColorSwatch } from "./color-swatch";
import { LogoUploader } from "./qr-logo-uploader";

interface QRAdvancedCustomizationProps {
  pixelStyle: QRPixelStyle;
  setPixelStyle: (style: QRPixelStyle) => void;
  markerShape: QRMarkerShape;
  setMarkerShape: (shape: QRMarkerShape) => void;
  markerInnerShape: QRMarkerInnerShape;
  setMarkerInnerShape: (shape: QRMarkerInnerShape) => void;
  darkColor: string;
  setDarkColor: (color: string) => void;
  lightColor: string;
  setLightColor: (color: string) => void;
  effect: QREffect;
  setEffect: (effect: QREffect) => void;
  effectRadius: number;
  setEffectRadius: (radius: number) => void;
  marginNoise: boolean;
  setMarginNoise: (enabled: boolean) => void;
  marginNoiseRate: number;
  setMarginNoiseRate: (rate: number) => void;
  // Logo props
  logoImage: string | undefined;
  setLogoImage: (image: string | undefined) => void;
  logoSize: number;
  setLogoSize: (size: number) => void;
  logoMargin: number;
  setLogoMargin: (margin: number) => void;
  logoBorderRadius: number;
  setLogoBorderRadius: (radius: number) => void;
}

export function QRAdvancedCustomization({
  pixelStyle,
  setPixelStyle,
  markerShape,
  setMarkerShape,
  markerInnerShape,
  setMarkerInnerShape,
  darkColor,
  setDarkColor,
  lightColor,
  setLightColor,
  effect,
  setEffect,
  effectRadius,
  setEffectRadius,
  marginNoise,
  setMarginNoise,
  marginNoiseRate,
  setMarginNoiseRate,
  logoImage,
  setLogoImage,
  logoSize,
  setLogoSize,
  logoMargin,
  setLogoMargin,
  logoBorderRadius,
  setLogoBorderRadius,
}: QRAdvancedCustomizationProps) {
  return (
    <div className="space-y-6">
      {/* Shape */}
      <div className="space-y-3">
        <p className="text-[13px] font-medium text-neutral-700">Shape</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-[12px] text-neutral-400">Pixel Style</Label>
            <Select
              value={pixelStyle}
              onValueChange={(value) => setPixelStyle(value as QRPixelStyle)}
            >
              <SelectTrigger className="h-9 border-neutral-200 bg-white text-[13px]">
                <SelectValue placeholder="Select style" />
              </SelectTrigger>
              <SelectContent>
                {pixelStyles.map((style) => (
                  <SelectItem key={style.value} value={style.value}>
                    {style.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px] text-neutral-400">Marker Shape</Label>
            <Select
              value={markerShape}
              onValueChange={(value) => setMarkerShape(value as QRMarkerShape)}
            >
              <SelectTrigger className="h-9 border-neutral-200 bg-white text-[13px]">
                <SelectValue placeholder="Select shape" />
              </SelectTrigger>
              <SelectContent>
                {markerShapes.map((shape) => (
                  <SelectItem key={shape.value} value={shape.value}>
                    {shape.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px] text-neutral-400">Inner Shape</Label>
            <Select
              value={markerInnerShape}
              onValueChange={(value) => setMarkerInnerShape(value as QRMarkerInnerShape)}
            >
              <SelectTrigger className="h-9 border-neutral-200 bg-white text-[13px]">
                <SelectValue placeholder="Select inner" />
              </SelectTrigger>
              <SelectContent>
                {markerInnerShapes.map((shape) => (
                  <SelectItem key={shape.value} value={shape.value}>
                    {shape.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Colors */}
      <div className="space-y-3">
        <p className="text-[13px] font-medium text-neutral-700">Colors</p>
        <div className="space-y-4">
          <ColorSwatch
            label="QR Code Color"
            color={darkColor}
            onChange={setDarkColor}
            presetColors={presetColors}
          />

          <ColorSwatch
            label="Background Color"
            color={lightColor}
            onChange={setLightColor}
            presetColors={presetBackgroundColors}
            showBorder
          />
        </div>
      </div>

      {/* Effects */}
      <div className="space-y-3">
        <p className="text-[13px] font-medium text-neutral-700">Effects</p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[12px] text-neutral-400">Effect Type</Label>
            <Select
              value={effect}
              onValueChange={(value) => setEffect(value as QREffect)}
            >
              <SelectTrigger className="h-9 border-neutral-200 bg-white text-[13px]">
                <SelectValue placeholder="Select effect" />
              </SelectTrigger>
              <SelectContent>
                {qrEffects.map((eff) => (
                  <SelectItem key={eff.value} value={eff.value}>
                    {eff.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {effect !== "none" && (
            <div className="space-y-2.5 rounded-lg border border-neutral-200 p-3">
              <div className="flex items-center justify-between">
                <Label className="text-[12px] text-neutral-400">Effect Intensity</Label>
                <span className="text-[12px] tabular-nums font-medium text-neutral-900">{effectRadius}</span>
              </div>
              <Slider
                value={[effectRadius]}
                onValueChange={([value]) => setEffectRadius(value ?? 12)}
                min={5}
                max={30}
                step={1}
              />
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-3">
            <div className="space-y-0.5">
              <Label htmlFor="margin-noise" className="text-[13px] font-medium text-neutral-700">
                Margin Noise
              </Label>
              <p className="text-[12px] text-neutral-400">
                Add decorative dots around the QR code
              </p>
            </div>
            <Switch
              id="margin-noise"
              checked={marginNoise}
              onCheckedChange={setMarginNoise}
            />
          </div>

          {marginNoise && (
            <div className="space-y-2.5 rounded-lg border border-neutral-200 p-3">
              <div className="flex items-center justify-between">
                <Label className="text-[12px] text-neutral-400">Noise Density</Label>
                <span className="text-[12px] tabular-nums font-medium text-neutral-900">{Math.round(marginNoiseRate * 100)}%</span>
              </div>
              <Slider
                value={[marginNoiseRate]}
                onValueChange={([value]) => setMarginNoiseRate(value ?? 0.5)}
                min={0.1}
                max={0.8}
                step={0.05}
              />
            </div>
          )}
        </div>
      </div>

      {/* Logo */}
      <div className="space-y-3">
        <p className="text-[13px] font-medium text-neutral-700">Logo</p>
        <div className="space-y-3">
          {logoImage ? (
            <div className="space-y-3">
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoImage}
                  alt="Logo preview"
                  className="h-16 w-16 rounded-lg object-cover border border-neutral-200"
                />
                <button
                  type="button"
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-600"
                  onClick={() => setLogoImage(undefined)}
                >
                  <IconX size={10} stroke={2} />
                </button>
              </div>

              <div className="space-y-2.5 rounded-lg border border-neutral-200 p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-[12px] text-neutral-400">Logo Size</Label>
                  <span className="text-[12px] tabular-nums font-medium text-neutral-900">{logoSize}%</span>
                </div>
                <Slider
                  value={[logoSize]}
                  onValueChange={([value]) => setLogoSize(value ?? 25)}
                  min={10}
                  max={40}
                  step={1}
                />
              </div>

              <div className="space-y-2.5 rounded-lg border border-neutral-200 p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-[12px] text-neutral-400">Logo Padding</Label>
                  <span className="text-[12px] tabular-nums font-medium text-neutral-900">{logoMargin}px</span>
                </div>
                <Slider
                  value={[logoMargin]}
                  onValueChange={([value]) => setLogoMargin(value ?? 4)}
                  min={0}
                  max={20}
                  step={1}
                />
              </div>

              <div className="space-y-2.5 rounded-lg border border-neutral-200 p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-[12px] text-neutral-400">Corner Radius</Label>
                  <span className="text-[12px] tabular-nums font-medium text-neutral-900">{logoBorderRadius}%</span>
                </div>
                <Slider
                  value={[logoBorderRadius]}
                  onValueChange={([value]) => setLogoBorderRadius(value ?? 8)}
                  min={0}
                  max={50}
                  step={1}
                />
              </div>
            </div>
          ) : (
            <LogoUploader setLogoImage={(image) => setLogoImage(image ?? undefined)} />
          )}
        </div>
      </div>
    </div>
  );
}

export default QRAdvancedCustomization;
