"use client";

import { Pipette } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ColorSwatchProps {
  color: string;
  onChange: (color: string) => void;
  presetColors: string[];
  label?: string;
  showBorder?: boolean;
}

// Validate hex color format
function isValidHex(hex: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
}

// Normalize hex to 6 digits
function normalizeHex(hex: string): string {
  if (!hex.startsWith("#")) {
    hex = "#" + hex;
  }
  if (hex.length === 4) {
    // Expand shorthand (#abc -> #aabbcc)
    return "#" + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }
  return hex;
}

export function ColorSwatch({
  color,
  onChange,
  presetColors,
  label,
  showBorder = false,
}: ColorSwatchProps) {
  const [open, setOpen] = useState(false);
  const [hexInput, setHexInput] = useState(color);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle popover open/close - sync input when opening
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        // Sync hex input with current color when opening
        setHexInput(color);
      }
      setOpen(isOpen);
    },
    [color]
  );

  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Allow clearing and typing freely
    setHexInput(value);

    // Only update parent if it's a valid complete hex
    if (isValidHex(value)) {
      onChange(normalizeHex(value));
    } else if (value.length > 0 && !value.startsWith("#")) {
      // Auto-add # if user forgets it and check validity
      const withHash = "#" + value;
      if (isValidHex(withHash)) {
        onChange(normalizeHex(withHash));
      }
    }
  };

  const handlePresetSelect = useCallback(
    (presetColor: string) => {
      onChange(presetColor);
      setHexInput(presetColor);
    },
    [onChange]
  );

  const isCustomColor = !presetColors.includes(color);

  return (
    <div className="space-y-3">
      {label && <Label className="text-xs text-gray-600">{label}</Label>}
      <div className="flex flex-wrap items-center gap-2">
        {/* Preset color swatches */}
        {presetColors.map((presetColor) => (
          <button
            type="button"
            key={presetColor}
            className={cn(
              "group relative rounded-xl p-0.5 transition-all duration-200",
              color === presetColor
                ? "ring-2 ring-blue-500 ring-offset-2"
                : "hover:ring-2 hover:ring-gray-300 hover:ring-offset-1"
            )}
            onClick={() => handlePresetSelect(presetColor)}
          >
            <div
              className={cn(
                "size-8 rounded-lg shadow-sm transition-transform group-hover:scale-105",
                showBorder && "border border-gray-200"
              )}
              style={{ backgroundColor: presetColor }}
            />
          </button>
        ))}

        {/* Custom color picker button */}
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "group relative rounded-xl p-0.5 transition-all duration-200",
                isCustomColor
                  ? "ring-2 ring-blue-500 ring-offset-2"
                  : "hover:ring-2 hover:ring-gray-300 hover:ring-offset-1"
              )}
            >
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg shadow-sm transition-transform group-hover:scale-105",
                  showBorder && "border border-gray-200"
                )}
                style={{
                  backgroundColor: isCustomColor ? color : "#f3f4f6",
                }}
              >
                <Pipette
                  className={cn(
                    "h-4 w-4 transition-colors",
                    isCustomColor ? "text-white drop-shadow-sm" : "text-gray-500"
                  )}
                />
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-64 p-4"
            align="start"
            sideOffset={8}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-700">
                  Custom Color
                </Label>
                <div className="flex gap-2">
                  {/* Native color input */}
                  <div className="relative">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => {
                        onChange(e.target.value);
                        setHexInput(e.target.value);
                      }}
                      className="absolute inset-0 h-10 w-10 cursor-pointer opacity-0"
                    />
                    <div
                      className="h-10 w-10 rounded-lg border border-gray-200 shadow-sm cursor-pointer"
                      style={{ backgroundColor: color }}
                    />
                  </div>
                  {/* Hex input */}
                  <Input
                    ref={inputRef}
                    type="text"
                    value={hexInput}
                    onChange={handleHexInputChange}
                    placeholder="#000000"
                    className="h-10 flex-1 font-mono text-sm"
                    maxLength={7}
                  />
                </div>
              </div>

              {/* Quick presets in popover */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-700">
                  Quick Select
                </Label>
                <div className="grid grid-cols-6 gap-1.5">
                  {[
                    "#000000",
                    "#374151",
                    "#6b7280",
                    "#9ca3af",
                    "#d1d5db",
                    "#ffffff",
                    "#ef4444",
                    "#f97316",
                    "#eab308",
                    "#22c55e",
                    "#06b6d4",
                    "#3b82f6",
                    "#8b5cf6",
                    "#ec4899",
                    "#f43f5e",
                    "#14b8a6",
                    "#84cc16",
                    "#a855f7",
                  ].map((quickColor) => (
                    <button
                      key={quickColor}
                      type="button"
                      className={cn(
                        "h-6 w-6 rounded-md border transition-all hover:scale-110",
                        color === quickColor
                          ? "border-blue-500 ring-1 ring-blue-500"
                          : "border-gray-200"
                      )}
                      style={{ backgroundColor: quickColor }}
                      onClick={() => {
                        onChange(quickColor);
                        setHexInput(quickColor);
                        setOpen(false);
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
