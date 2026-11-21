"use client";

import { useEffect } from "react";

import { api } from "@/trpc/react";

import type { PlanLimitViewKey } from "@/lib/billing/plan-limits";

/**
 * Logs a gated screen to `PlanLimitHit` once per browser session while
 * `enabled` is true. The server also dedupes per day and ignores paid plans.
 */
export function useRecordPlanLimitView(limitKey: PlanLimitViewKey, enabled: boolean) {
  const { mutate } = api.planLimits.recordView.useMutation();

  useEffect(() => {
    if (!enabled) return;
    const storageKey = `plan-limit-view:${limitKey}`;
    try {
      if (sessionStorage.getItem(storageKey)) return;
      sessionStorage.setItem(storageKey, "1");
    } catch {
      // Storage can be unavailable (private mode); the server dedupes per day anyway.
    }
    mutate({ limitKey });
  }, [enabled, limitKey, mutate]);
}
