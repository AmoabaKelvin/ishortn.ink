import type { Metadata } from "next";

import { Footer } from "../_components/footer";
import { Header } from "../_components/header";
import { FeaturesClient } from "./_components/features-client";

export const metadata: Metadata = {
  title: "Features - Free URL Shortener with Analytics | iShortn",
  description:
    "Explore iShortn's powerful features: link analytics, custom domains, QR codes, password protection, API access, and team collaboration. Everything you need to manage your links.",
  keywords: [
    "url shortener features",
    "link analytics",
    "custom domains",
    "qr code generator",
    "link management features",
  ],
  openGraph: {
    title: "Features - Free URL Shortener with Analytics | iShortn",
    description:
      "Explore iShortn's powerful features: link analytics, custom domains, QR codes, password protection, API access, and team collaboration. Everything you need to manage your links.",
    type: "website",
  },
};

export default function FeaturesPage() {
  return (
    <main className="relative bg-zinc-950">
      <Header />
      <FeaturesClient />
      <Footer />
    </main>
  );
}
