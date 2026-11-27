"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useEffect } from "react";

import { isInternalEmail } from "@/lib/analytics/internal-accounts";
import { identifyUser, resetPostHogIdentity } from "@/lib/analytics/posthog";

// Separate from posthog.tsx so marketing pages, which have no ClerkProvider, don't ship Clerk.
export function PostHogIdentify() {
  const { isLoaded, user } = useUser();
  const userId = user?.id ?? null;
  const internal = isInternalEmail(user?.primaryEmailAddress?.emailAddress);
  useEffect(() => {
    if (isLoaded) identifyUser(userId, internal);
  }, [isLoaded, userId, internal]);
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
