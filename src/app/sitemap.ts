import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://www.ishortn.ink",
      lastModified: new Date(),
    },
  ];
}
