"use client";

import { useEffect } from "react";

import { readFirstTouchCookie, writeFirstTouchCookie } from "@/lib/attribution/browser";
import { buildFirstTouch, serializeFirstTouch } from "@/lib/attribution/first-touch";

// Mounted in the marketing and auth layouts. First touch wins: an existing
// cookie is never overwritten.
export function FirstTouchCapture() {
  useEffect(() => {
    if (readFirstTouchCookie()) return;
    const touch = buildFirstTouch({
      url: window.location.href,
      referrer: document.referrer,
      now: Date.now(),
    });
    if (touch) writeFirstTouchCookie(serializeFirstTouch(touch));
  }, []);

  return null;
}
