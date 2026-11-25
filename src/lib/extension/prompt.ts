// Shared state for the in-app browser extension prompts (Settings and the link-ready dialog).
// Dismissing either one hides both, through one localStorage key and a same-tab event.

import { CHROME_WEB_STORE_URL } from "@/lib/constants/extension";

const DISMISS_KEY = "ishortn:extension-prompt-dismissed-at";
const DISMISS_EVENT = "ishortn:extension-prompt:dismiss";
const LINK_READY_VIEWS_KEY = "ishortn:extension-prompt-link-ready-views";

/** The link-ready note stops after this many dialogs per browser. */
export const LINK_READY_MAX_VIEWS = 3;

export const LINK_READY_STORE_URL = `${CHROME_WEB_STORE_URL}?${new URLSearchParams({
  utm_source: "dashboard",
  utm_medium: "in_app",
  utm_campaign: "extension_launch",
  utm_content: "link_ready",
}).toString()}`;

/**
 * Desktop Chrome, Edge and other Chromium browsers, which can install the extension from the
 * Chrome Web Store. iOS browsers and Android (phones and tablets) can't, nor can Safari or Firefox.
 */
export function isDesktopChromium(userAgent: string): boolean {
  if (!/Chrome\/|Chromium\/|Edg\//.test(userAgent)) return false;
  return !/Mobi|Android|iPhone|iPad|iPod/.test(userAgent);
}

export function subscribeExtensionPromptDismissed(onChange: () => void) {
  window.addEventListener(DISMISS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(DISMISS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function readExtensionPromptDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) !== null;
  } catch {
    return false;
  }
}

export function dismissExtensionPrompt() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // Storage can be unavailable (private mode); the prompt then just stays.
  }
  window.dispatchEvent(new Event(DISMISS_EVENT));
}

export function readLinkReadyViews(): number {
  try {
    const views = Number(window.localStorage.getItem(LINK_READY_VIEWS_KEY));
    return Number.isFinite(views) ? views : 0;
  } catch {
    // Without storage the cap can't be kept, so don't show the note at all.
    return LINK_READY_MAX_VIEWS;
  }
}

export function recordLinkReadyView() {
  try {
    window.localStorage.setItem(LINK_READY_VIEWS_KEY, String(readLinkReadyViews() + 1));
  } catch {
    // Unavailable storage already reads as the cap reached.
  }
}

/** Whether this browser may see the link-ready note, before checking connected browsers. */
export function canShowLinkReadyPrompt(): boolean {
  return (
    isDesktopChromium(window.navigator.userAgent) &&
    !readExtensionPromptDismissed() &&
    readLinkReadyViews() < LINK_READY_MAX_VIEWS
  );
}
