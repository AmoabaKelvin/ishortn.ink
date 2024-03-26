import "@/styles/globals.css";

import { ClerkProvider } from "@clerk/nextjs";
import { Nunito_Sans } from "next/font/google";
import Script from "next/script";

import ClientProvider from "@/components/providers/client-provider";
import { Toaster } from "@/components/ui/sonner";
import { env } from "@/env.mjs";

import type { Metadata } from "next";
const nunito = Nunito_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "iShortn",
  description:
    "Dynamic links, URL shortener, and QR code generator. Firebase shutting down? No problem, we got you covered.",
  authors: [
    {
      name: "Kelvin Amoaba",
      url: "https://www.kelvinamoaba.live",
    },
  ],
  keywords: [
    "dynamic links",
    "iShortn",
    "shorten",
    "url",
    "shortener",
    "link",
    "links",
    "short",
    "shortened",
    "shortening",
    "shorten link",
    "shorten links",
    "shorten url",
    "shorten urls",
    "url shortener",
    "url shorteners",
    "link shortener",
    "link shorteners",
    "shorten link",
    "shorten links",
    "shorten url",
    "shorten urls",
    "url shortener",
    "url shorteners",
    "link shortener",
    "link shorteners",
    "shorten link",
    "shorten links",
    "shorten url",
    "shorten urls",
    "url shortener",
    "url shorteners",
    "link shortener",
    "link shorteners",
    "shorten link",
    "shorten links",
    "shorten url",
    "shorten urls",
    "url shortener",
    "url shorteners",
    "link shortener",
    "link shorteners",
    "shorten link",
    "shorten links",
    "shorten url",
    "shorten urls",
    "url shortener",
    "url shorteners",
    "link shortener",
    "link shorteners",
    "shorten link",
    "shorten links",
    "shorten url",
    "shorten urls",
    "url shortener",
    "url shorteners",
    "link shortener",
    "link shorteners",
    "shorten link",
    "shorten links",
    "shorten url",
    "shorten urls",
    "url shortener",
    "url shorteners",
    "link shortener",
    "link shorteners",
    "shorten link",
    "shorten links",
    "shorten url",
    "shorten urls",
    "url shortener",
    "url shorteners",
    "link shortener",
    "link shorteners",
  ],
  applicationName: "iShortn",
  creator: "Kelvin Amoaba",
  robots: "index, follow",
  category: "Technology",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      {env.UMAMI_TRACKING_ID && (
        <Script
          defer
          src="https://umami.kelvinamoaba.live/script.js"
          data-website-id={env.UMAMI_TRACKING_ID}
        />
      )}

      <html lang="en">
        <body className={nunito.className}>
          <Toaster />
          <ClientProvider />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
