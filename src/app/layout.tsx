import "@/styles/globals.css";

import { ClerkProvider } from "@clerk/nextjs";
import { ViewTransitions } from "next-view-transitions";
import Script from "next/script";

import { MicrosoftClarityScript } from "@/components/scripts/clarity";
import { ReleaseNotesScript } from "@/components/scripts/release-notes";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { env } from "@/env.mjs";
import { APP_TITLE } from "@/lib/constants/app";
import {
  fontDisplay,
  fontHeading,
  fontLogo,
  fontSans,
  fontWarmDisplay,
  fontWarmUi,
} from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { TRPCReactProvider } from "@/trpc/react";

import { CSPostHogProvider } from "./providers";

import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://ishortn.ink"),
  title: {
    default: APP_TITLE,
    template: `%s | ${APP_TITLE}`,
  },
  description:
    "Free URL shortener with powerful analytics. Create custom short links, track clicks, locations, and devices. QR codes, custom domains, and API included.",
  icons: [{ rel: "icon", url: "/icon.png" }],
  openGraph: {
    siteName: "iShortn",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
  },
  alternates: {
    canonical: "./",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <ViewTransitions>
        {env.UMAMI_TRACKING_ID && (
          <Script
            strategy="lazyOnload"
            src={env.UMAMI_URL}
            data-website-id={env.UMAMI_TRACKING_ID}
          />
        )}
        <ReleaseNotesScript />
        <html lang="en" suppressHydrationWarning>
          <MicrosoftClarityScript />
          <CSPostHogProvider>
            <body
              className={cn(
                "min-h-screen bg-background font-sans antialiased",
                fontSans.variable,
                fontDisplay.variable,
                fontHeading.variable,
                fontLogo.variable,
                fontWarmDisplay.variable,
                fontWarmUi.variable
              )}
            >
              <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
              >
                <TRPCReactProvider>{children}</TRPCReactProvider>
                <Toaster />
              </ThemeProvider>
            </body>
          </CSPostHogProvider>
        </html>
      </ViewTransitions>
    </ClerkProvider>
  );
}
