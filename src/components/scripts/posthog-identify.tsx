"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { useEffect } from "react";

import { identifyUser, resetPostHogIdentity } from "@/lib/analytics/posthog";

// Separate from posthog.tsx so marketing pages, which have no ClerkProvider, don't ship Clerk.
export function PostHogIdentify() {
  const { isLoaded, userId } = useAuth();
  useEffect(() => {
    if (isLoaded) identifyUser(userId ?? null);
  }, [isLoaded, userId]);
  return null;
}

/** Clerk's signOut, with PostHog's identity reset first (see resetPostHogIdentity). */
export function useSignOut() {
  const { signOut } = useClerk();
  return async (options?: { redirectUrl?: string }) => {
    await resetPostHogIdentity();
    await signOut(options);
  };
}
