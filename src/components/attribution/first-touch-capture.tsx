"use client";

import { useEffect } from "react";

import { readFirstTouchCookie, writeFirstTouchCookie } from "@/lib/attribution/browser";
import { buildFirstTouch, isDirectTouch, serializeFirstTouch } from "@/lib/attribution/first-touch";
import { clientLogger } from "@/lib/logger/client";

// Mounted in the marketing and auth layouts. First touch wins, except that a
// direct visit (no UTM, click ID or external referrer) is replaced by the first
// later visit that has a source, so a bare earlier visit doesn't hide the
// campaign or referrer that brought someone back to sign up.
export function FirstTouchCapture() {
  useEffect(() => {
    const now = new Date();
    const value = serializeFirstTouch(
      buildFirstTouch({
        url: window.location.href,
        referrer: document.referrer,
        now: now.getTime(),
      }),
    );
    const existing = readFirstTouchCookie();
    if (!existing) {
      writeFirstTouchCookie(value);
      return;
    }

    // The parser (and zod with it) loads only for returning visitors, so a first
    // visit, which is most search traffic, doesn't download or run it.
    import("@/lib/attribution/parse-first-touch")
      .then(({ parseFirstTouch }) => {
        const prior = parseFirstTouch(existing, now);
        if (prior && !isDirectTouch(prior)) return;
        const next = parseFirstTouch(value, now);
        if (prior && (!next || isDirectTouch(next))) return;
        writeFirstTouchCookie(value);
      })
      .catch((error) =>
        clientLogger.warn(
          { err: error instanceof Error ? error : String(error) },
          "first-touch parser failed to load",
        ),
      );
  }, []);

  return null;
}
