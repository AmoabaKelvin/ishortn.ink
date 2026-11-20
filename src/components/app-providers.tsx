import { ClerkProvider } from "@clerk/nextjs";
import Script from "next/script";

import { CSPostHogProvider } from "@/app/providers";
import { MicrosoftClarityScript } from "@/components/scripts/clarity";
import { env } from "@/env.mjs";

import type { ReactNode } from "react";

// Auth and analytics for the iShortn app itself (marketing, auth, dashboard).
// Short links, interstitials and bio pages render without these: Clerk's
// production keys only work on ishortn.ink, so loading it on short and custom
// domains fails in the browser.
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider
      localization={{
        signIn: { start: { title: "Welcome back", subtitle: "Sign in to continue" } },
        signUp: {
          start: { title: "Create your account", subtitle: "Start shortening in seconds" },
        },
      }}
    >
      {env.UMAMI_TRACKING_ID && (
        <Script strategy="lazyOnload" src={env.UMAMI_URL} data-website-id={env.UMAMI_TRACKING_ID} />
      )}
      <MicrosoftClarityScript />
      <CSPostHogProvider>{children}</CSPostHogProvider>
    </ClerkProvider>
  );
}
