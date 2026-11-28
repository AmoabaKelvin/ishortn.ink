"use client";

import { IconX } from "@tabler/icons-react";
import { useSyncExternalStore } from "react";

import { isLaunchStripActive } from "@/lib/billing/promo";

const DISMISS_KEY = "ph-launch-2026-dismissed";
const DISMISS_EVENT = "ishortn:launch-strip:dismiss";

function subscribe(onChange: () => void) {
  window.addEventListener(DISMISS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(DISMISS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// Decided in the browser: marketing pages are cached for up to an hour, so a server-side clock
// could show the strip late or keep it after the window. The server renders nothing, so visitors
// who dismissed it never see it flash in.
function readVisible() {
  if (!isLaunchStripActive()) return false;
  try {
    return window.localStorage.getItem(DISMISS_KEY) === null;
  } catch {
    return true;
  }
}

const readVisibleOnServer = () => false;

/** Dismissible Product Hunt launch-day strip above the marketing header. */
export function LaunchStrip() {
  const visible = useSyncExternalStore(subscribe, readVisible, readVisibleOnServer);
  if (!visible) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Storage can be unavailable (private mode); the strip then hides for this page view only.
    }
    window.dispatchEvent(new Event(DISMISS_EVENT));
  };

  return (
    <div className="relative border-b border-neutral-950/[0.07] bg-white px-12 py-2 text-center text-sm text-neutral-600 motion-safe:duration-200 motion-safe:animate-in motion-safe:fade-in-0">
      <p className="text-pretty">
        We're on Product Hunt today.{" "}
        <a
          href="https://ishortn.ink/site-banner-ph"
          target="_blank"
          rel="noopener"
          className="font-medium text-neutral-900 underline decoration-neutral-950/20 underline-offset-4 hover:decoration-neutral-900"
        >
          Come say hi<span className="sr-only"> (opens in a new tab)</span>
        </a>
        , and use code <span className="font-medium text-neutral-900">PRODUCTHUNT20</span> for 20%
        off your first year.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-950/5 hover:text-neutral-900"
      >
        <IconX className="size-4" />
      </button>
    </div>
  );
}
