"use client";

import { useEffect } from "react";

import { Paths } from "@/lib/constants/app";

import type { ClerkScripts } from "@/lib/auth/clerk-scripts";

const AUTH_PATHS: string[] = [Paths.Signup, Paths.Login];
const INTENT_EVENTS = ["pointerdown", "touchstart", "mouseover", "focusin", "input"] as const;

// Once per document: the layout can remount on client-side navigation.
let warmed = false;

function showsSignUpIntent(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  if (target.closest("[data-clerk-warmup]")) return true;
  const anchor = target.closest("a");
  return (
    !!anchor &&
    anchor.origin === window.location.origin &&
    AUTH_PATHS.some((path) => anchor.pathname.startsWith(path))
  );
}

function addLink(attributes: Record<string, string>) {
  const link = document.createElement("link");
  for (const [name, value] of Object.entries(attributes)) link.setAttribute(name, value);
  document.head.appendChild(link);
}

/**
 * Marketing pages ship no Clerk, so the auth page starts Clerk's script chain cold. The first
 * sign of sign-up intent (the hero URL field, or a sign-up/sign-in link being hovered, touched or
 * focused) opens the connection to Clerk and prefetches its scripts into the HTTP cache, without
 * running them. Nothing is requested before that, so the page's own load is unchanged.
 */
export function ClerkWarmup({ clerk }: { clerk: ClerkScripts | null }) {
  useEffect(() => {
    if (!clerk || warmed) return;
    const { origin, scripts } = clerk;
    // SAFETY: navigator.connection (Network Information API, Chromium only) is missing from
    // TypeScript's DOM lib; it is undefined in other browsers, which the optional type covers.
    const { connection } = navigator as Navigator & { connection?: { saveData?: boolean } };
    if (connection?.saveData) return;

    const options = { capture: true, passive: true } as const;
    const stop = () => {
      for (const type of INTENT_EVENTS) document.removeEventListener(type, onIntent, options);
    };
    function onIntent(event: Event) {
      if (warmed || !showsSignUpIntent(event.target)) return;
      warmed = true;
      stop();
      if (origin) {
        // Script fetches are CORS without credentials and the frontend API calls send cookies;
        // browsers keep those on separate connections, so warm both.
        addLink({ rel: "preconnect", href: origin, crossorigin: "anonymous" });
        addLink({ rel: "preconnect", href: origin });
      }
      // crossorigin matches the <script crossorigin="anonymous"> Clerk adds, so the cached
      // response is reused.
      for (const href of scripts) addLink({ rel: "prefetch", href, crossorigin: "anonymous" });
    }

    for (const type of INTENT_EVENTS) document.addEventListener(type, onIntent, options);
    return stop;
  }, [clerk]);

  return null;
}
