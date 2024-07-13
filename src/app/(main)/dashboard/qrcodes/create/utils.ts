import { z } from "zod";

export function isValidUrlAndNotIshortn(url: string) {
  const urlSchema = z.string().url();
  const isValidUrl = urlSchema.safeParse(url);
  return isValidUrl.success && !isValidUrl.data.includes("ishortn.ink");
}
