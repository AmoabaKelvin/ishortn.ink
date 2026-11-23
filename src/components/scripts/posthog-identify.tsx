"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";

import { identifyUser } from "@/lib/analytics/posthog";

// Separate from posthog.tsx so marketing pages, which have no ClerkProvider, don't ship Clerk.
export function PostHogIdentify() {
  const { isLoaded, userId } = useAuth();
  useEffect(() => {
    if (isLoaded) identifyUser(userId ?? null);
  }, [isLoaded, userId]);
  return null;
}
