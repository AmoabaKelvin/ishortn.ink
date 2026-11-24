import { AuthProviders } from "@/components/auth-providers";
import { TRPCReactProvider } from "@/trpc/react";

import type { ReactNode } from "react";

// Auth, tRPC and analytics for the dashboard layout. Marketing pages use
// AnalyticsProviders only, so they skip Clerk's browser bundle and the tRPC
// client; the auth pages use AuthProviders. Clerk's production keys only work
// on ishortn.ink, so short and custom domains must not load it either.
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProviders>
      <TRPCReactProvider>{children}</TRPCReactProvider>
    </AuthProviders>
  );
}
