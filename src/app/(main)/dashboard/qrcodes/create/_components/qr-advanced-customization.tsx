"use client";

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
} from "@/lib/constants/qrcode";
import { cn } from "@/lib/utils";
import type {
  QRPixelStyle,
  QRMarkerShape,
  QRMarkerInnerShape,
  QREffect,
} from "@/lib/qr-generator/types";

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
}: QRAdvancedCustomizationProps) {
  return (
    <div className="space-y-6">
      {/* Pixel Style */}
      <div className="space-y-2">
        <Label>Pixel Style</Label>
        <Select
          value={pixelStyle}
          onValueChange={(value) => setPixelStyle(value as QRPixelStyle)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select pixel style" />
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

      {/* Marker Shape */}
      <div className="space-y-2">
        <Label>Marker Shape</Label>
        <Select
          value={markerShape}
          onValueChange={(value) => setMarkerShape(value as QRMarkerShape)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select marker shape" />
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

      {/* Marker Inner Shape */}
      <div className="space-y-2">
        <Label>Marker Inner Shape</Label>
        <Select
          value={markerInnerShape}
          onValueChange={(value) => setMarkerInnerShape(value as QRMarkerInnerShape)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select inner shape" />
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

      {/* Dark Color */}
      <div className="space-y-2">
        <Label>QR Code Color</Label>
        <div className="flex flex-wrap gap-3">
          {presetColors.map((color) => (
            <button
              type="button"
              key={color}
              className={cn("rounded-full border-2 p-1 hover:cursor-pointer transition-all", {
                "border-blue-500 ring-2 ring-blue-200": darkColor === color,
                "border-transparent": darkColor !== color,
              })}
              onClick={() => setDarkColor(color)}
            >
              <div
                className="size-8 rounded-full"
                style={{ backgroundColor: color }}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Background Color */}
      <div className="space-y-2">
        <Label>Background Color</Label>
        <div className="flex flex-wrap gap-3">
          {["#ffffff", "#f5f5f5", "#000000", "#1a1a2e", "#f0f0f0"].map((color) => (
            <button
              type="button"
              key={color}
              className={cn("rounded-full border-2 p-1 hover:cursor-pointer transition-all", {
                "border-blue-500 ring-2 ring-blue-200": lightColor === color,
                "border-gray-300": lightColor !== color,
              })}
              onClick={() => setLightColor(color)}
            >
              <div
                className="size-8 rounded-full border border-gray-200"
                style={{ backgroundColor: color }}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Effect */}
      <div className="space-y-2">
        <Label>Effect</Label>
        <Select
          value={effect}
          onValueChange={(value) => setEffect(value as QREffect)}
        >
          <SelectTrigger>
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

      {/* Effect Radius (only shown when effect is not none) */}
      {effect !== "none" && (
        <div className="space-y-2">
          <Label>Effect Intensity: {effectRadius}</Label>
          <Slider
            value={[effectRadius]}
            onValueChange={([value]) => setEffectRadius(value ?? 12)}
            min={5}
            max={30}
            step={1}
          />
        </div>
      )}

      {/* Margin Noise */}
      <div className="flex items-center justify-between space-x-2">
        <Label htmlFor="margin-noise" className="flex flex-col gap-1">
          <span>Margin Noise</span>
          <span className="font-normal text-xs text-muted-foreground">
            Add decorative noise dots around the QR code
          </span>
        </Label>
        <Switch
          id="margin-noise"
          checked={marginNoise}
          onCheckedChange={setMarginNoise}
        />
      </div>

      {/* Margin Noise Rate (only shown when margin noise is enabled) */}
      {marginNoise && (
        <div className="space-y-2">
          <Label>Noise Density: {Math.round(marginNoiseRate * 100)}%</Label>
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
  );
}

export default QRAdvancedCustomization;
