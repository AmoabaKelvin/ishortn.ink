"use client";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";

import { env } from "@/env.mjs";

// eslint-disable-next-line anti-slop/no-runtime-typeof -- SSR guard
if (typeof window !== "undefined" && env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: env.NEXT_PUBLIC_POSTHOG_HOST,
    person_profiles: "always", // or 'always' to create profiles for anonymous users as well
  });
}
export function CSPostHogProvider({ children }: { children: React.ReactNode }) {
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
