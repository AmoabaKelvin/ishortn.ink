import "@/styles/globals.css";

import { ClerkProvider } from "@clerk/nextjs";
import Script from "next/script";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { env } from "@/env";
import { APP_TITLE } from "@/lib/constants";
import { fontSans } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { TRPCReactProvider } from "@/trpc/react";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      {env.UMAMI_TRACKING_ID && (
        <Script
          defer
          src={env.UMAMI_URL as string}
          data-website-id={env.UMAMI_TRACKING_ID as string}
        />
      )}
      <html lang="en" suppressHydrationWarning>
        <body className={cn("min-h-screen bg-background font-sans antialiased", fontSans.variable)}>
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
      </html>
    </ClerkProvider>
  );
}
