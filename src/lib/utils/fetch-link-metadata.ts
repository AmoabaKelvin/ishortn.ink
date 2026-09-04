import { z } from "zod";

const metadataSchema = z.object({
  title: z.string(),
  description: z.string(),
  image: z.string(),
  favicon: z.string(),
});

// Client-side helper; server code should call scrapeMetadata from
// @/server/lib/metadata directly instead of going through HTTP.
export async function fetchMetadataInfo(url: string) {
  const response = await fetch(`/api/metadata?url=${encodeURIComponent(url)}`);

  if (!response.ok) {
    throw new Error(`metadata endpoint responded ${response.status}`);
  }

  return metadataSchema.parse(await response.json());
}
