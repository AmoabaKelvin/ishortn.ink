import type { Me } from "./api.ts";

export type UiErrorKind = "upgrade" | "invalid" | "unauthorized" | "rate_limited" | "retry";

export type UiError = {
  kind: UiErrorKind;
  message: string;
  upgradeUrl?: string;
};

export type ErrorBody = { error?: unknown; upgradeUrl?: unknown } | null | undefined;

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const retryAfterText = (retryAfter: string | null | undefined): string => {
  const seconds = Number(retryAfter);
  if (!Number.isFinite(seconds) || seconds <= 0) return "Try again in a moment.";
  if (seconds < 60) {
    const s = Math.ceil(seconds);
    return `Try again in ${s} ${s === 1 ? "second" : "seconds"}.`;
  }
  const m = Math.ceil(seconds / 60);
  return `Try again in ${m} ${m === 1 ? "minute" : "minutes"}.`;
};

/**
 * Maps an API failure to what the popup shows. `status` 0 means the request never got a
 * response (offline, DNS, CORS); it's treated like a 5xx and offered a retry.
 */
export const mapApiError = (
  status: number,
  body: ErrorBody,
  retryAfter?: string | null,
): UiError => {
  const serverMessage = text(body?.error);
  if (status === 401) {
    return { kind: "unauthorized", message: "This browser was disconnected. Connect again to continue." };
  }
  if (status === 403) {
    const upgradeUrl = text(body?.upgradeUrl) ?? undefined;
    return {
      kind: upgradeUrl ? "upgrade" : "invalid",
      message: serverMessage ?? "Your plan doesn't include this.",
      upgradeUrl,
    };
  }
  if (status === 429) {
    return {
      kind: "rate_limited",
      message: `${serverMessage ?? "Too many requests."} ${retryAfterText(retryAfter)}`,
    };
  }
  if (status >= 400 && status < 500) {
    return { kind: "invalid", message: serverMessage ?? "iShortn couldn't use that link." };
  }
  if (status === 0) {
    return { kind: "retry", message: "Couldn't reach iShortn. Check your connection and try again." };
  }
  return { kind: "retry", message: "iShortn is having trouble right now. Try again in a moment." };
};

/**
 * The limit screen for an account /me already shows at its monthly cap, so the popup doesn't
 * send a create the server would refuse. Null below the cap or without one. Same wording as the
 * server's refusal.
 */
export const monthlyLimitError = (me: Me): UiError | null => {
  if (me.linksLimit === null || me.linksUsedThisMonth < me.linksLimit) return null;
  const next = me.plan === "free" ? "Upgrade to Pro for more." : "Upgrade to Ultra for unlimited links.";
  return {
    kind: "upgrade",
    message: `You've reached your monthly limit of ${me.linksLimit.toLocaleString("en-US")} links. ${next}`,
    upgradeUrl: me.upgradeUrl,
  };
};
