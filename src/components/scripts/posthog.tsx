"use client";

import { useEffect } from "react";

import { holdPostHog, loadPostHog } from "@/lib/analytics/posthog";

export function PostHogScript() {
  useEffect(loadPostHog, []);
  return null;
}

/** Holds PostHog back while mounted (see holdPostHog). */
export function PostHogHold() {
  useEffect(holdPostHog, []);
  return null;
}
