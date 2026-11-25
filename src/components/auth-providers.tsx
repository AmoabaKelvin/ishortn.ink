import { ClerkProvider } from "@clerk/nextjs";

import { AnalyticsProviders } from "@/components/analytics-providers";
import { PostHogIdentify } from "@/components/scripts/posthog-identify";
import { clerkLocalization } from "@/lib/auth/clerk-localization";

import type { ReactNode } from "react";

// Clerk and analytics without tRPC, for the auth pages: they make no tRPC calls, and every chunk
// they skip is one less between the visitor and a usable sign-up form. In its own module so
// importing it doesn't pull app-providers.tsx's tRPC client into the auth route.
export function AuthProviders({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider localization={clerkLocalization}>
      <AnalyticsProviders>
        <PostHogIdentify />
        {children}
      </AnalyticsProviders>
    </ClerkProvider>
  );
}
