"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
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
    <div className="space-y-8">
      {/* Shape Section */}
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <div className="h-1 w-1 rounded-full bg-blue-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Shape</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-xs text-gray-600">Pixel Style</Label>
            <Select
              value={pixelStyle}
              onValueChange={(value) => setPixelStyle(value as QRPixelStyle)}
            >
              <SelectTrigger className="h-10">
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

          <div className="space-y-2">
            <Label className="text-xs text-gray-600">Marker Shape</Label>
            <Select
              value={markerShape}
              onValueChange={(value) => setMarkerShape(value as QRMarkerShape)}
            >
              <SelectTrigger className="h-10">
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

          <div className="space-y-2">
            <Label className="text-xs text-gray-600">Inner Shape</Label>
            <Select
              value={markerInnerShape}
              onValueChange={(value) => setMarkerInnerShape(value as QRMarkerInnerShape)}
            >
              <SelectTrigger className="h-10">
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

      {/* Colors Section */}
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <div className="h-1 w-1 rounded-full bg-blue-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Colors</span>
        </div>

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

      {/* Effects Section */}
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <div className="h-1 w-1 rounded-full bg-blue-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Effects</span>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-gray-600">Effect Type</Label>
            <Select
              value={effect}
              onValueChange={(value) => setEffect(value as QREffect)}
            >
              <SelectTrigger className="h-10">
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
            <div className="space-y-3 rounded-xl bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-600">Effect Intensity</Label>
                <span className="text-xs font-medium text-gray-900">{effectRadius}</span>
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

          <div className="flex items-center justify-between rounded-xl bg-gray-50 p-4">
            <div className="space-y-0.5">
              <Label htmlFor="margin-noise" className="text-sm font-medium text-gray-900">
                Margin Noise
              </Label>
              <p className="text-xs text-gray-500">
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
            <div className="space-y-3 rounded-xl bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-600">Noise Density</Label>
                <span className="text-xs font-medium text-gray-900">{Math.round(marginNoiseRate * 100)}%</span>
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

      {/* Logo Section */}
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <div className="h-1 w-1 rounded-full bg-blue-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Logo</span>
        </div>

        <div className="space-y-4">
          {logoImage ? (
            <div className="space-y-4">
              <div className="relative inline-block">
                <img
                  src={logoImage}
                  alt="Logo preview"
                  className="h-20 w-20 rounded-lg object-cover border border-gray-200"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -right-2 -top-2 h-6 w-6 rounded-full"
                  onClick={() => setLogoImage(undefined)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>

              <div className="space-y-3 rounded-xl bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-gray-600">Logo Size</Label>
                  <span className="text-xs font-medium text-gray-900">{logoSize}%</span>
                </div>
                <Slider
                  value={[logoSize]}
                  onValueChange={([value]) => setLogoSize(value ?? 25)}
                  min={10}
                  max={40}
                  step={1}
                />
              </div>

              <div className="space-y-3 rounded-xl bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-gray-600">Logo Padding</Label>
                  <span className="text-xs font-medium text-gray-900">{logoMargin}px</span>
                </div>
                <Slider
                  value={[logoMargin]}
                  onValueChange={([value]) => setLogoMargin(value ?? 4)}
                  min={0}
                  max={20}
                  step={1}
                />
              </div>

              <div className="space-y-3 rounded-xl bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-gray-600">Corner Radius</Label>
                  <span className="text-xs font-medium text-gray-900">{logoBorderRadius}%</span>
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
