import "@/styles/globals.css";
import { ViewTransitions } from "next-view-transitions";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { APP_TITLE } from "@/lib/constants/app";
import { fontDisplay, fontHeading, fontLogo, fontSans } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { fontTitle, inter } from "@/styles/fonts";
import { TRPCReactProvider } from "@/trpc/react";

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

// Kept free of Clerk and analytics: short links, interstitials and bio pages
// render on short and custom domains. App routes add them via AppProviders.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransitions>
      <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
        <body
          className={cn(
            "min-h-screen bg-background font-sans antialiased",
            fontSans.variable,
            fontDisplay.variable,
            fontHeading.variable,
            fontLogo.variable,
            fontTitle.variable,
            inter.variable,
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
      </html>
    </ViewTransitions>
  );
}
