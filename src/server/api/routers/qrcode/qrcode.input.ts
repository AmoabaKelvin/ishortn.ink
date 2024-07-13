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
