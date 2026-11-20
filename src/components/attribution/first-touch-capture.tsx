"use client";

import { useEffect } from "react";

import { readFirstTouchCookie, writeFirstTouchCookie } from "@/lib/attribution/browser";
import {
  buildFirstTouch,
  isDirectTouch,
  parseFirstTouch,
  serializeFirstTouch,
} from "@/lib/attribution/first-touch";

// Mounted in the marketing and auth layouts. First touch wins, except that a
// direct visit (no UTM, click ID or external referrer) is replaced by the first
// later visit that has a source, so a bare earlier visit doesn't hide the
// campaign or referrer that brought someone back to sign up.
export function FirstTouchCapture() {
  useEffect(() => {
    const now = new Date();
    const existing = readFirstTouchCookie();
    const prior = existing ? parseFirstTouch(existing, now) : null;
    if (prior && !isDirectTouch(prior)) return;

    const value = serializeFirstTouch(
      buildFirstTouch({
        url: window.location.href,
        referrer: document.referrer,
        now: now.getTime(),
      }),
    );
    const next = parseFirstTouch(value, now);
    if (prior && (!next || isDirectTouch(next))) return;
    writeFirstTouchCookie(value);
  }, []);

  return null;
}
