// The JSON an embed block keeps in `content`. Server-side only (the service
// writes and reads it); the editor and the public page get it already parsed.

import { z } from "zod";

import { buildEmbedSrc, EMBED_PROVIDERS, type EmbedDetails } from "./embed";

const storedSchema = z.object({
  kind: z.literal("embed"),
  provider: z.enum(EMBED_PROVIDERS),
  embedId: z.string(),
  title: z.string().optional(),
});

export function serializeEmbed(details: EmbedDetails): string {
  // JSON.stringify drops an undefined title.
  return JSON.stringify({
    kind: "embed",
    provider: details.provider,
    embedId: details.embedId,
    title: details.title || undefined,
  });
}

/** The stored details of an embed block, or null when they're invalid or off the allow-list. */
export function parseEmbed(content: string | null): EmbedDetails | null {
  if (!content) return null;
  try {
    const parsed = storedSchema.safeParse(JSON.parse(content));
    if (!parsed.success || !buildEmbedSrc(parsed.data)) return null;
    return {
      provider: parsed.data.provider,
      embedId: parsed.data.embedId,
      title: parsed.data.title,
    };
  } catch {
    return null;
  }
}
