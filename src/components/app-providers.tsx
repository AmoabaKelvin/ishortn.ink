import { ClerkProvider } from "@clerk/nextjs";

import { AnalyticsProviders } from "@/components/analytics-providers";
import { clerkLocalization } from "@/lib/auth/clerk-localization";
import { TRPCReactProvider } from "@/trpc/react";

import type { ReactNode } from "react";

// Auth, tRPC and analytics for the auth and dashboard layouts. Marketing pages
// use AnalyticsProviders only, so they skip Clerk's browser bundle and the tRPC
// client. Clerk's production keys only work on ishortn.ink, so short and custom
// domains must not load it either.
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider localization={clerkLocalization}>
      <TRPCReactProvider>
        <AnalyticsProviders>{children}</AnalyticsProviders>
      </TRPCReactProvider>
    </ClerkProvider>
  );
}
