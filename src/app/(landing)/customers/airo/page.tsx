import { JsonLd } from "@/components/seo/json-ld";
import { createArticleSchema, createBreadcrumbSchema } from "@/lib/seo/structured-data";
import "@/styles/site-content.css";

import { CTA } from "../../_components/cta";
import { Footer } from "../../_components/footer";
import { Header } from "../../_components/header";
import { AiroStory } from "./_components/airo-story";

import type { Metadata } from "next";

const PATH = "/customers/airo";
const PAGE_URL = `https://ishortn.ink${PATH}`;
const PUBLISHED_ON = "2026-11-27";

const title = "How AIRO cut $5,000 in rack card spend with iShortn";
const description =
  "AIRO, an aviation company in Missouri and Arkansas, uses iShortn to track traffic from its partners and campaigns. The data showed rack cards weren't working.";

export const metadata: Metadata = {
  // Absolute: the title already names the brand, so skip the root `%s | iShortn` template.
  title: { absolute: title },
  description,
  alternates: { canonical: PATH },
  openGraph: {
    title,
    description,
    type: "article",
    publishedTime: PUBLISHED_ON,
    url: PATH,
  },
  twitter: { card: "summary_large_image", title, description },
};

export default function AiroCustomerStoryPage() {
  const articleSchema = {
    ...createArticleSchema({
      title,
      description,
      url: PAGE_URL,
      datePublished: PUBLISHED_ON,
      dateModified: PUBLISHED_ON,
      author: "iShortn",
    }),
    author: { "@type": "Organization", name: "iShortn", url: "https://ishortn.ink" },
  };
  const breadcrumbSchema = createBreadcrumbSchema([
    { name: "Home", url: "https://ishortn.ink" },
    { name: "AIRO customer story", url: PAGE_URL },
  ]);

  return (
    <main>
      <Header />

      <JsonLd data={articleSchema} />
      <JsonLd data={breadcrumbSchema} />

      <AiroStory />

      <CTA />
      <Footer />
    </main>
  );
}
