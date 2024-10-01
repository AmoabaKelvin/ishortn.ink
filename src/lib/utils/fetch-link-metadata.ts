export async function fetchMetadataInfo(url: string) {
  const response = await fetch("https://meta.kelvinamoaba.com/metadata?url=" + url);

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
