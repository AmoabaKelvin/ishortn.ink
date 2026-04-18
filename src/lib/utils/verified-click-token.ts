import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { env } from "@/env.mjs";

// Payload is plaintext; the only secret is the HMAC signature. Replay is
// bounded by the 5-minute TTL plus the verify endpoint's `verifiedAt IS NULL`
// guard, so any valid token can mark a visit verified at most once. The
// destination hash is signed into the token so the interstitial page can
// reject requests whose `to` query param doesn't match the original issue.

const TOKEN_VERSION = "v2";
const TOKEN_TTL_MS = 5 * 60 * 1000;
const CLOCK_SKEW_TOLERANCE_MS = 5_000;

function base64urlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(str: string): Buffer {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function getSecret(): string | null {
  return env.VERIFIED_CLICKS_SECRET ?? null;
}

/** Canonicalize so sign-side and verify-side produce identical bytes regardless
 * of trailing slashes, hostname case, default ports, etc. If the URL fails to
 * parse, fall back to the raw string so both sides still agree. */
function canonicalizeDestination(raw: string): string {
  try {
    return new URL(raw).toString();
  } catch {
    return raw;
  }
}

/** Short, URL-safe fingerprint that binds a token to its intended destination. */
export function hashDestination(destination: string): string {
  return base64urlEncode(
    createHash("sha256")
      .update(canonicalizeDestination(destination))
      .digest()
      .subarray(0, 16),
  );
}

export function generateVisitId(): string {
  return randomUUID();
}

/** Returns null when the secret is unset; caller treats that as feature-disabled. */
export function signVerifiedClickToken(
  visitId: string,
  destination: string,
): string | null {
  const secret = getSecret();
  if (!secret) return null;

  const issuedAt = Date.now();
  const destHash = hashDestination(destination);
  const payload = `${TOKEN_VERSION}.${visitId}.${destHash}.${issuedAt}`;
  const sig = base64urlEncode(
    createHmac("sha256", secret).update(payload).digest(),
  );
  return `${payload}.${sig}`;
}

const INLINE_SCRIPT_ESCAPES: Record<string, string> = {
  "<": "\\u003C",
  ">": "\\u003E",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

/** JSON-encode a value for safe embedding inside an inline `<script>` tag. */
function encodeForInlineScript(value: string): string {
  return JSON.stringify(value).replace(
    /[<>&\u2028\u2029]/g,
    (char) => INLINE_SCRIPT_ESCAPES[char] ?? char,
  );
}

/** Inline JS for the beacon. Callers render it in a `<script>` tag. */
export function buildBeaconScript(token: string): string {
  const safeToken = encodeForInlineScript(token);
  return `(function(){try{fetch('/api/v1/clicks/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:${safeToken}}),keepalive:true}).catch(function(){});}catch(e){}})();`;
}

export function verifyVerifiedClickToken(
  token: string,
): { visitId: string; destHash: string } | null {
  const secret = getSecret();
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 5) return null;

  const [version, visitId, destHash, issuedAtStr, providedSig] = parts;
  if (
    version !== TOKEN_VERSION ||
    !visitId ||
    !destHash ||
    !issuedAtStr ||
    !providedSig
  ) {
    return null;
  }

  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt)) return null;

  const now = Date.now();
  if (now - issuedAt > TOKEN_TTL_MS) return null;
  if (issuedAt - now > CLOCK_SKEW_TOLERANCE_MS) return null;

  const payload = `${version}.${visitId}.${destHash}.${issuedAtStr}`;
  const expected = createHmac("sha256", secret).update(payload).digest();
  const provided = base64urlDecode(providedSig);
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  return { visitId, destHash };
}
