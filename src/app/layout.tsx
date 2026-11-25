import "@/styles/globals.css";
import { ViewTransitions } from "next-view-transitions";

import { ThemeProvider } from "@/components/theme-provider";
import { APP_TITLE } from "@/lib/constants/app";
import { fontDisplay, fontHeading, fontSans } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { fontTitle, inter } from "@/styles/fonts";

import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://ishortn.ink"),
  title: {
    default: APP_TITLE,
    template: `%s | ${APP_TITLE}`,
  },
  description:
    "Free URL shortener with powerful analytics. Create custom short links, track clicks, locations, and devices. QR codes, custom domains, and API included.",
  icons: [
    // favicon.ico is added by Next from src/app; modern browsers prefer the vector.
    { rel: "icon", url: "/icon.svg", type: "image/svg+xml" },
    { rel: "icon", url: "/icon.png", type: "image/png", sizes: "512x512" },
    { rel: "apple-touch-icon", url: "/apple-icon.png", sizes: "180x180" },
  ],
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

// Kept free of Clerk, tRPC, analytics and the toast container: short links,
// interstitials and bio pages render on short and custom domains, and marketing
// and auth pages stay light. Route-group layouts add what they need
// (AppProviders, AuthProviders, AnalyticsProviders, Toaster).
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
            fontTitle.variable,
            inter.variable,
          )}
        >
          {/* No disableTransitionOnChange: next-themes also applies it on every page load, adding and
              removing a global stylesheet that forces two style recalculations of the whole page
              while it hydrates. ThemeToggle turns transitions off for the switches users make. */}
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ViewTransitions>
  );
}
