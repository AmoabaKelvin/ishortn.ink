"use client";

import { useEffect } from "react";

import { clearFirstTouchCookie, readFirstTouchCookie } from "@/lib/attribution/browser";
import { clientLogger } from "@/lib/logger/client";
import { api } from "@/trpc/react";

const log = clientLogger.child({ component: "attribution-recorder" });

// Hands the first-touch cookie to the server once. The server decides whether
// it is attributable (new account, no row yet); any successful answer means the
// cookie has done its job, so it is cleared either way. A rejected cookie
// (BAD_REQUEST) will never succeed, so it is cleared too; other failures keep the
// cookie for the next load. Nothing surfaces in the UI.
export function AttributionRecorder() {
  const { mutate } = api.attribution.record.useMutation({
    onSuccess: () => clearFirstTouchCookie(),
    onError: (error) => {
      if (error.data?.code === "BAD_REQUEST") clearFirstTouchCookie();
      log.warn({ error: error.message }, "failed to record attribution");
    },
  });

  useEffect(() => {
    const cookie = readFirstTouchCookie();
    if (cookie) mutate({ cookie });
  }, [mutate]);

  return null;
}
