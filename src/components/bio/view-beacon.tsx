"use client";

import { useEffect, useRef } from "react";

/**
 * Fires a single page-view beacon to /api/bio/view on mount. The endpoint
 * records the view through the same quota-aware pipeline as link clicks.
 */
export function BioPageViewBeacon({ bioPageId }: { bioPageId: number }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void fetch("/api/bio/view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bioPageId }),
      keepalive: true,
    }).catch(() => {});
  }, [bioPageId]);

  return null;
}
