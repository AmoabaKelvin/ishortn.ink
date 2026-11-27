import crypto from "node:crypto";

// Paddle's documented tolerance. Each delivery attempt is signed afresh, so retries never carry
// an old ts.
const MAX_SKEW_SECONDS = 5;

export type PaddleSignatureResult =
  | { ok: true }
  | { ok: false; reason: "missing_header" | "malformed_header" | "signature_mismatch" }
  | { ok: false; reason: "timestamp_out_of_range"; skewSeconds: number };

/**
 * Verifies a `Paddle-Signature` header (`ts=<unix seconds>;h1=<hex>[;h1=<hex>…]`) against the raw
 * request body. Several `h1` values appear while a secret is being rotated; any match passes.
 */
export function verifyPaddleSignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string,
  now = Date.now(),
): PaddleSignatureResult {
  if (!header) return { ok: false, reason: "missing_header" };

  let ts: string | undefined;
  const signatures: string[] = [];
  for (const part of header.split(";")) {
    const [key, value, ...rest] = part.trim().split("=");
    if (rest.length > 0 || !value) return { ok: false, reason: "malformed_header" };
    if (key === "ts") ts = value;
    else if (key === "h1") signatures.push(value);
  }
  if (!ts || !/^\d+$/.test(ts) || signatures.length === 0) {
    return { ok: false, reason: "malformed_header" };
  }

  const skewSeconds = Math.floor(now / 1000) - Number(ts);
  if (Math.abs(skewSeconds) > MAX_SKEW_SECONDS) {
    return { ok: false, reason: "timestamp_out_of_range", skewSeconds };
  }

  const expected = Buffer.from(
    crypto.createHmac("sha256", secret).update(`${ts}:${rawBody}`).digest("hex"),
    "utf8",
  );
  const matches = signatures.some((signature) => {
    const provided = Buffer.from(signature.toLowerCase(), "utf8");
    // timingSafeEqual throws on a length mismatch instead of returning false.
    return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
  });
  return matches ? { ok: true } : { ok: false, reason: "signature_mismatch" };
}
