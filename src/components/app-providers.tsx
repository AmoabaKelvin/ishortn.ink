import { ClerkProvider } from "@clerk/nextjs";

import { TRPCReactProvider } from "@/trpc/react";

import type { ReactNode } from "react";

// Mounted by the app and auth layouts only. Marketing pages stay off Clerk's
// browser bundle and the tRPC client to keep their JavaScript small.
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
      <TRPCReactProvider>{children}</TRPCReactProvider>
    </ClerkProvider>
  );
}
