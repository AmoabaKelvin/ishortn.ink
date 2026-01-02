import { z } from "zod";

export const qrcodeInput = z.object({
  wasShortened: z.boolean(),
  title: z.string().optional(),
  content: z.string(),
  patternStyle: z.string(),
  cornerStyle: z.string(),
  selectedColor: z.string(),
  qrCodeBase64: z.string(),
});

export const qrcodeLinkUpdate = z.object({
  url: z.string(),
});

export const qrcodeUpdate = qrcodeLinkUpdate.extend({
  id: z.number(),
});

export const qrcodeDeleteInput = z.object({
  id: z.number(),
});

export type QRCodeInput = z.infer<typeof qrcodeInput>;

// QR Preset schemas
const hexColorSchema = z.string().regex(/^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/, "Invalid hex color");

const marginNoiseRateSchema = z
  .string()
  .refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 1;
  }, "marginNoiseRate must be a number between 0 and 1");

export const qrPresetCreateInput = z.object({
  name: z.string().min(1, "Name is required").max(255),
  pixelStyle: z.string().default("rounded"),
  markerShape: z.string().default("square"),
  markerInnerShape: z.string().default("auto"),
  darkColor: hexColorSchema.default("#000000"),
  lightColor: hexColorSchema.default("#ffffff"),
  effect: z.string().default("none"),
  effectRadius: z.number().min(5).max(30).default(12),
  marginNoise: z.boolean().default(false),
  marginNoiseRate: marginNoiseRateSchema.default("0.5"),
});

export const qrPresetDeleteInput = z.object({
  id: z.number(),
});

export const qrPresetUpdateInput = z.object({
  id: z.number(),
  pixelStyle: z.string(),
  markerShape: z.string(),
  markerInnerShape: z.string(),
  darkColor: hexColorSchema,
  lightColor: hexColorSchema,
  effect: z.string(),
  effectRadius: z.number().min(5).max(30),
  marginNoise: z.boolean(),
  marginNoiseRate: marginNoiseRateSchema,
});

export type QRPresetCreateInput = z.infer<typeof qrPresetCreateInput>;
export type QRPresetUpdateInput = z.infer<typeof qrPresetUpdateInput>;
