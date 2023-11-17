import { MetadataRoute } from "next";

const pages = [
  "dashboard",
  "dashboard/analytics",
  "dashboard/links",
  "dashboard/profile",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://www.ishortn.ink",
      lastModified: new Date(),
    },
    ...pages.map((page) => ({
      url: `https://www.ishortn.ink/${page}`,
      lastModified: new Date(),
    })),
  ];
}
