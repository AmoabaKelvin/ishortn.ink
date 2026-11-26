"use client";

import { clientLogger } from "@/lib/logger/client";

import { createDeferredClient } from "./deferred-client";
import {
  buildBeaconBody,
  isLikelyBot,
  postHogPersistenceName,
  resolveBeaconIdentity,
} from "./pageview-beacon";
import { createIdentityTracker, createPageviewTracker } from "./posthog-tracking";

import type { BeaconIdentity, QueuedPageview } from "./pageview-beacon";
import type { PostHog } from "posthog-js/dist/module.slim";

// Inlined at build time. Read here rather than through @/env.mjs, which would put zod and
// t3-env in the client bundle of every page that loads analytics.
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

const IDLE_TIMEOUT_MS = 2000;
// Longest a page can hold PostHog back, in case what it waits for never finishes.
const MAX_HOLD_MS = 10_000;
const INTERACTION_EVENTS = ["pointerdown", "keydown"] as const;
// Scrolling counts as interaction for holdPostHogUntilInteraction, not for the idle start: a
// restored scroll position fires it during load.
const HOLD_RELEASE_EVENTS = [...INTERACTION_EVENTS, "scroll"] as const;

const deferred = createDeferredClient<PostHog>(100);
let loadStarted = false;
let importStarted = false;
let holds = 0;
let resumeAfterHolds: (() => void) | null = null;
// Page views posthog-js hasn't sent yet. sendUnsentPageviews beacons them if the page is hidden
// first, and the queued capture then skips them.
const unsentPageviews = new Set<QueuedPageview>();
// Set once a beacon has gone out with ids posthog-js didn't make, so posthog-js adopts them.
let beaconIdentity: BeaconIdentity | null = null;
const capturePageview = createPageviewTracker(
  (call) =>
    call({
      capture: (_event, properties, { timestamp }) => {
        const pageview = { properties, timestamp };
        unsentPageviews.add(pageview);
        deferred.run((posthog) => {
          if (unsentPageviews.delete(pageview)) {
            posthog.capture("$pageview", properties, { timestamp });
          }
        });
      },
    }),
  () => document.cookie,
);
const syncIdentity = createIdentityTracker(deferred.run);

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

function readLocalStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Sends the page views posthog-js hasn't sent with sendBeacon, for a visitor leaving (or hiding
 * the tab) before it has loaded. Uses the visitor's stored PostHog ids, or new ones that posthog-js
 * is bootstrapped with if it loads later on this page.
 */
function sendUnsentPageviews() {
  if (!POSTHOG_KEY || unsentPageviews.size === 0 || !("sendBeacon" in navigator)) return;
  if (isLikelyBot(navigator.userAgent, navigator.webdriver)) return;
  const identity =
    beaconIdentity ??
    resolveBeaconIdentity(
      POSTHOG_KEY,
      document.cookie,
      readLocalStorage(postHogPersistenceName(POSTHOG_KEY)),
    );
  const body = buildBeaconBody(POSTHOG_KEY, identity, [...unsentPageviews], {
    title: document.title,
    search: window.location.search,
    referrer: document.referrer,
    userAgent: navigator.userAgent,
    screen: { width: window.screen.width, height: window.screen.height },
    viewport: { width: window.innerWidth, height: window.innerHeight },
  });
  const url = `${POSTHOG_HOST.replace(/\/$/, "")}/i/v0/e/?compression=base64`;
  if (!navigator.sendBeacon(url, new Blob([body], { type: "text/plain" }))) return;
  unsentPageviews.clear();
  beaconIdentity = identity;
}

function sendUnsentPageviewsWhenHidden() {
  if (document.visibilityState === "hidden") sendUnsentPageviews();
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
 * holdPostHog until the visitor first taps, types or scrolls (or 10 s pass). For content pages,
 * where posthog-js start-up would otherwise land in the middle of the first render on a slow
 * phone. Page views from visitors who leave first are sent by sendUnsentPageviews.
 */
export function holdPostHogUntilInteraction() {
  const release = holdPostHog();
  const releaseOnInteraction = () => {
    for (const type of HOLD_RELEASE_EVENTS) {
      window.removeEventListener(type, releaseOnInteraction, true);
    }
    release();
  };
  for (const type of HOLD_RELEASE_EVENTS) {
    window.addEventListener(type, releaseOnInteraction, { capture: true, passive: true });
  }
  return releaseOnInteraction;
}

function importPostHog() {
  if (importStarted || !POSTHOG_KEY) return;
  importStarted = true;
  for (const type of INTERACTION_EVENTS) window.removeEventListener(type, startWhenFree, true);
  // The slim build has no extensions of its own. It gets the analytics ones (autocapture,
  // heatmaps, dead clicks, web vitals; each still switched on by PostHog's remote config) and the
  // toolbar, which shows heatmaps on the site. Leaving out replay, surveys, feature flags and
  // error tracking halves the download, and surveys.js is no longer fetched on every page.
  import("./posthog-slim")
    .then(({ posthog, AnalyticsExtensions, ToolbarExtensions }) => {
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        person_profiles: "always",
        // Sent by capturePageview, on load and on each client-side navigation, with the URL each
        // was for. Page leaves would otherwise follow capture_pageview off.
        capture_pageview: false,
        capture_pageleave: true,
        bootstrap: beaconIdentity
          ? {
              distinctID: beaconIdentity.bootstrap.distinctId
                ? beaconIdentity.distinctId
                : undefined,
              sessionID: beaconIdentity.bootstrap.sessionId ? beaconIdentity.sessionId : undefined,
            }
          : undefined,
        __extensionClasses: { ...AnalyticsExtensions, ...ToolbarExtensions },
      });
      deferred.ready(posthog);
    })
    .catch((error) =>
      clientLogger.warn(
        { err: error instanceof Error ? error : String(error) },
        "posthog-js failed to load",
      ),
    );
}

function startWhenFree() {
  if (importStarted) return;
  if (holds > 0) {
    resumeAfterHolds = startWhenFree;
    return;
  }
  importPostHog();
}

/**
 * Records the page view for this document, then loads and initialises posthog-js once the
 * browser is idle (at most 2 s) or the visitor first interacts, whichever comes first, and no
 * hold is active, so it doesn't compete with the page for the network and main thread.
 */
export function loadPostHog() {
  if (!POSTHOG_KEY || loadStarted) return;
  loadStarted = true;
  capturePageview(window.location);
  document.addEventListener("visibilitychange", sendUnsentPageviewsWhenHidden);
  window.addEventListener("pagehide", sendUnsentPageviews);

  for (const type of INTERACTION_EVENTS) {
    window.addEventListener(type, startWhenFree, { capture: true, once: true, passive: true });
  }
  whenIdle(startWhenFree);
}

/**
 * Records a page view for the current URL after a client-side navigation. The first call on a
 * document loads PostHog instead, which records it; repeats for the same path are ignored.
 */
export function trackPageview() {
  if (!POSTHOG_KEY) return;
  if (loadStarted) capturePageview(window.location);
  else loadPostHog();
}

/** Identifies the signed-in user (by id only), or resets PostHog's identity when signed out. */
export function identifyUser(userId: string | null) {
  if (POSTHOG_KEY) syncIdentity(userId);
}

// Long enough for posthog-js to load on a typical connection, short enough not to stall sign-out.
const SIGN_OUT_RESET_TIMEOUT_MS = 1000;

/**
 * Resets PostHog's identity for a sign-out the app starts. Clerk only reports the signed-out state
 * after it has navigated to the after-sign-out page, where PostHogIdentify isn't mounted, so the
 * reset has to happen first. Resolves once it has run (loading posthog-js now if needed) or after
 * a second.
 */
export function resetPostHogIdentity() {
  if (!POSTHOG_KEY) return Promise.resolve();
  syncIdentity(null);
  return withPostHogNow(() => {}, SIGN_OUT_RESET_TIMEOUT_MS);
}

/**
 * Loads posthog-js straight away, skipping the idle wait and any hold, and runs `call` with it.
 * Resolves once `call` has run or after `timeoutMs`, whichever is first. For events sent just
 * before a full page navigation, which would discard calls still queued for PostHog.
 */
export function withPostHogNow(call: (posthog: PostHog) => void, timeoutMs: number) {
  if (!POSTHOG_KEY) return Promise.resolve();
  loadPostHog();
  importPostHog();
  return deferred.runWithin(call, timeoutMs);
}
