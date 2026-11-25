export type AuthRedirectResult =
  | { ok: true; token: string }
  | { ok: false; reason: "cancelled" | "state_mismatch" | "missing_token" | "error"; message: string };

const STATE_BYTES = 32;

/** 32 random bytes as base64url: 43 URL-safe characters (server accepts 16-128). */
type RandomFill = (bytes: Uint8Array<ArrayBuffer>) => Uint8Array;

const defaultRandom: RandomFill = (bytes) => crypto.getRandomValues(bytes);

export const generateState = (random: RandomFill = defaultRandom): string => {
  const bytes = random(new Uint8Array(STATE_BYTES));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/**
 * Parses the URL that launchWebAuthFlow resolves with. The server puts the result in the
 * fragment (`#token=…&state=…` or `#error=…&state=…`) so it never reaches a server log.
 * The state is compared before anything else so a forged redirect can't plant a token.
 */
export const parseAuthRedirect = (
  redirectUrl: string | undefined,
  expectedState: string,
): AuthRedirectResult => {
  if (!redirectUrl) {
    return { ok: false, reason: "cancelled", message: "Connection was cancelled." };
  }
  let hash: string;
  try {
    hash = new URL(redirectUrl).hash;
  } catch {
    return { ok: false, reason: "error", message: "The sign-in window returned an invalid address." };
  }
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  if (params.get("state") !== expectedState) {
    return {
      ok: false,
      reason: "state_mismatch",
      message: "The sign-in response didn't match this request. Try connecting again.",
    };
  }
  const error = params.get("error");
  if (error === "access_denied") {
    return { ok: false, reason: "cancelled", message: "Connection was cancelled." };
  }
  if (error) {
    return { ok: false, reason: "error", message: "iShortn couldn't connect this browser. Try again." };
  }
  const token = params.get("token");
  if (!token) {
    return { ok: false, reason: "missing_token", message: "iShortn didn't return a token. Try again." };
  }
  return { ok: true, token };
};
