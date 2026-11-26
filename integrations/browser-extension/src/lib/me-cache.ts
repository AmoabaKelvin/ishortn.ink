import type { Me } from "./api.ts";
import { defaultAutoShorten } from "./format.ts";
import { local } from "./storage.ts";

export type MeCache = { me: Me; savedAt: number };

const PLANS: ReadonlySet<string> = new Set(["free", "pro", "ultra"]);

/** The cached account, or null when missing or written in a shape this version doesn't know. */
export const parseMeCache = (value: unknown): Me | null => {
  if (!value || typeof value !== "object") return null;
  const me = (value as { me?: unknown }).me; // checked field by field below
  if (!me || typeof me !== "object") return null;
  const m = me as Record<string, unknown>; // checked field by field below
  const ok =
    typeof m.email === "string" &&
    typeof m.plan === "string" &&
    PLANS.has(m.plan) &&
    typeof m.linksUsedThisMonth === "number" &&
    (m.linksLimit === null || typeof m.linksLimit === "number") &&
    Array.isArray(m.domains) &&
    typeof m.upgradeUrl === "string";
  return ok ? (me as Me) : null; // shape verified above
};

/** Whether opening the popup on a shortenable page creates a link: the saved switch, else the plan default. */
export const shouldAutoShorten = (storedAuto: boolean | undefined, plan: string): boolean =>
  storedAuto ?? defaultAutoShorten(plan);

// The last /me response, so the popup can render before the network answers. Cleared whenever
// the token changes or is removed, so it never outlives the account it belongs to.
export const meCache = {
  load: async (): Promise<Me | null> => parseMeCache(await local.get("meCache")),
  save: (me: Me, now = Date.now()): Promise<void> => local.set("meCache", { me, savedAt: now }),
  clear: (): Promise<void> => local.remove("meCache"),
};
