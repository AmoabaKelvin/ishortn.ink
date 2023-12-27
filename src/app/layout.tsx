import "@/styles/globals.css";
import type { Metadata } from "next";
import { Nunito_Sans } from "next/font/google";

import { Toaster as ShadToaster } from "@/components/ui/toaster";
import { Toaster } from "react-hot-toast";
const nunito = Nunito_Sans({ subsets: ["latin"] });

import Script from "next/script";

import ClientProvider from "@/components/providers/client-provider";
import { ClerkProvider } from "@clerk/nextjs";

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
      <Script type="text/javascript" id="ms_clarity">
        {`(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "iv16reka4j")`}
        ;
      </Script>

      <html lang="en">
        <body className={nunito.className}>
          <Toaster />
          <ShadToaster />
          <ClientProvider />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
