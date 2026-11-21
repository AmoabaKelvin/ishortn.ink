"use client";

import { clientLogger } from "@/lib/logger/client";

import { createDeferredClient } from "./deferred-client";

import type { PostHog } from "posthog-js";

// Inlined at build time. Read here rather than through @/env.mjs, which would put zod and
// t3-env in the client bundle of every page that loads analytics.
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;

const IDLE_TIMEOUT_MS = 2000;
// Longest a page can hold PostHog back, in case what it waits for never finishes.
const MAX_HOLD_MS = 10_000;
const INTERACTION_EVENTS = ["pointerdown", "keydown"] as const;

const deferred = createDeferredClient<PostHog>(100);
let loadStarted = false;
let holds = 0;
let resumeAfterHolds: (() => void) | null = null;

function whenIdle(callback: () => void) {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(callback, { timeout: IDLE_TIMEOUT_MS });
  } else {
    setTimeout(callback, IDLE_TIMEOUT_MS);
  }
}

/** Runs `call` with PostHog now if it has loaded, otherwise once it does. */
export function withPostHog(call: (posthog: PostHog) => void) {
  if (POSTHOG_KEY) deferred.run(call);
}

/**
 * Keeps posthog-js from loading until the returned release is called (or 10 s pass). Idle
 * callbacks also fire while the page waits on the network, so without a hold PostHog's
 * download and start-up compete with the requests and rendering the page is waiting for.
 */
export function holdPostHog() {
  holds += 1;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    clearTimeout(timer);
    holds -= 1;
    if (holds === 0 && resumeAfterHolds) {
      whenIdle(resumeAfterHolds);
      resumeAfterHolds = null;
    }
  };
  const timer = setTimeout(release, MAX_HOLD_MS);
  return release;
}

/**
 * Records the page view for this document, then loads and initialises posthog-js once the
 * browser is idle (at most 2 s) or the visitor first interacts, whichever comes first, and no
 * hold is active, so it doesn't compete with the page for the network and main thread.
 */
export function loadPostHog() {
  if (!POSTHOG_KEY || loadStarted) return;
  loadStarted = true;

  // Taken now: by the time PostHog loads, a client-side navigation may have changed the URL.
  const { href, host, pathname } = window.location;
  const title = document.title;
  const timestamp = new Date();
  deferred.run((posthog) =>
    posthog.capture(
      "$pageview",
      { $current_url: href, $host: host, $pathname: pathname, title },
      { timestamp },
    ),
  );

  let started = false;
  const start = () => {
    if (started) return;
    if (holds > 0) {
      resumeAfterHolds = start;
      return;
    }
    started = true;
    for (const type of INTERACTION_EVENTS) window.removeEventListener(type, start, true);
    import("posthog-js")
      .then(({ default: posthog }) => {
        posthog.init(POSTHOG_KEY, {
          api_host: POSTHOG_HOST,
          person_profiles: "always",
          // Sent above with the URL of the page it was loaded on. Page leaves would otherwise
          // follow capture_pageview off.
          capture_pageview: false,
          capture_pageleave: true,
        });
        deferred.ready(posthog);
      })
      .catch((error) =>
        clientLogger.warn(
          { err: error instanceof Error ? error : String(error) },
          "posthog-js failed to load",
        ),
      );
  };

  for (const type of INTERACTION_EVENTS) {
    window.addEventListener(type, start, { capture: true, once: true, passive: true });
  }
  whenIdle(start);
}
