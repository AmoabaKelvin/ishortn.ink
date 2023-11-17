import "@/styles/globals.css";
import type { Metadata } from "next";
import { Nunito_Sans } from "next/font/google";

import { Toaster as ShadToaster } from "@/components/ui/toaster";
import { Toaster } from "react-hot-toast";
const nunito = Nunito_Sans({ subsets: ["latin"] });

import Script from "next/script";

import { ClerkProvider } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "iShortn",
  description: `Power up your links with our AI-driven analytics, advanced URL
  shortening, and dynamic QR code creation and boost engagement
  results like never before. Unleash the power of your links today!`,
  authors: [
    {
      name: "Kelvin Amoaba",
      url: "https://www.kelvinamoaba.live",
    },
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
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
