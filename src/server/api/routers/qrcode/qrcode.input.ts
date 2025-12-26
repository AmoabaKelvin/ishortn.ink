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
export const qrPresetCreateInput = z.object({
  name: z.string().min(1, "Name is required").max(255),
  pixelStyle: z.string().default("rounded"),
  markerShape: z.string().default("square"),
  markerInnerShape: z.string().default("auto"),
  darkColor: z.string().default("#000000"),
  lightColor: z.string().default("#ffffff"),
  effect: z.string().default("none"),
  effectRadius: z.number().min(5).max(30).default(12),
  marginNoise: z.boolean().default(false),
  marginNoiseRate: z.number().min(0).max(1).default(0.5),
});

export const qrPresetDeleteInput = z.object({
  id: z.number(),
});

export type QRPresetCreateInput = z.infer<typeof qrPresetCreateInput>;
