// Client-side helper; server code should call scrapeMetadata from
// @/server/lib/metadata directly instead of going through HTTP.
export async function fetchMetadataInfo(url: string) {
  const response = await fetch(`/api/metadata?url=${encodeURIComponent(url)}`);

  if (!response.ok) {
    throw new Error(`metadata endpoint responded ${response.status}`);
  }

  const data = (await response.json()) as {
    title: string;
    description: string;
    image: string;
    favicon: string;
  };

  return {
    title: data.title,
    description: data.description,
    image: data.image,
    favicon: data.favicon,
  };
}
