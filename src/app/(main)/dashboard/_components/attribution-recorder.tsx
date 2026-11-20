"use client";

import { useEffect } from "react";

import { clearFirstTouchCookie, readFirstTouchCookie } from "@/lib/attribution/browser";
import { clientLogger } from "@/lib/logger/client";
import { api } from "@/trpc/react";

const log = clientLogger.child({ component: "attribution-recorder" });

// Hands the first-touch cookie to the server once. The server decides whether
// it is attributable (new account, no row yet); any successful answer means the
// cookie has done its job, so it is cleared either way. Failures keep the cookie
// for the next load and never surface in the UI.
export function AttributionRecorder() {
  const { mutate } = api.attribution.record.useMutation({
    onSuccess: () => clearFirstTouchCookie(),
    onError: (error) => log.warn({ error: error.message }, "failed to record attribution"),
  });

  useEffect(() => {
    const cookie = readFirstTouchCookie();
    if (cookie) mutate({ cookie });
  }, [mutate]);

  return null;
}
