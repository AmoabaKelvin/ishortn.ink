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
import { fontSans, fontDisplay } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { TRPCReactProvider } from "@/trpc/react";

import { CSPostHogProvider } from "./providers";

import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: {
    default: APP_TITLE,
    template: `%s | ${APP_TITLE}`,
  },
  description: "iShortn - Link shortening with analytics(without the fuss)",
  icons: [{ rel: "icon", url: "/icon.png" }],
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
            defer
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
                fontDisplay.variable
              )}
            >
              {/* we ship dark theme later, now light theme */}
              <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem={false}
                forcedTheme="light"
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
