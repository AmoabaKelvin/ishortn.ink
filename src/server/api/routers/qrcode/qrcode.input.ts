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

// Logo image validator: must be a valid base64 data URI (PNG/JPEG) under 2MB
const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const logoImageSchema = z
  .string()
  .regex(
    /^data:image\/(png|jpe?g);base64,[A-Za-z0-9+/]+=*$/,
    "Logo must be a valid base64 PNG or JPEG data URI"
  )
  .refine((dataUri) => {
    // Extract the base64 payload after the comma
    const base64Payload = dataUri.split(",")[1];
    if (!base64Payload) return false;

    // Calculate decoded byte length (accounting for padding)
    const padding = (base64Payload.match(/=+$/) || [""])[0].length;
    const decodedSize = Math.ceil((base64Payload.length * 3) / 4) - padding;

    return decodedSize <= MAX_LOGO_SIZE_BYTES;
  }, "Logo image must be under 2MB")
  .nullish();

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
  // Logo settings
  logoImage: logoImageSchema,
  logoSize: z.number().min(10).max(40).default(25),
  logoMargin: z.number().min(0).max(20).default(4),
  logoBorderRadius: z.number().min(0).max(50).default(8),
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
  // Logo settings
  logoImage: logoImageSchema,
  logoSize: z.number().min(10).max(40),
  logoMargin: z.number().min(0).max(20),
  logoBorderRadius: z.number().min(0).max(50),
});

export type QRPresetCreateInput = z.infer<typeof qrPresetCreateInput>;
export type QRPresetUpdateInput = z.infer<typeof qrPresetUpdateInput>;
