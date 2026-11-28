import crypto from "crypto";

/**
 * Returns a 64-char hex digest of the visitor IP.
 *
 * When `secret` (`IP_HASH_SECRET`) is set we HMAC the IP with the secret; this prevents
 * trivial rainbow-table reversal of the hash back to an IP (plain SHA-256 of
 * an IPv4 address is brute-forceable in seconds). Existing rows hashed under
 * the old scheme remain valid — they simply stop matching new inserts, so a
 * visitor seen before the cutover is counted fresh afterwards.
 *
 * When the secret is unset, falls back to the previous SHA-256 behavior so
 * we don't break environments that haven't been updated yet.
 *
 * The secret is passed in rather than read from env.mjs: the worker's cached
 * redirect hashes visitor IPs outside the Next bundle (cached-redirect.ts).
 */
export function hashIp(ip: string, secret: string | undefined): string {
  if (secret) {
    return crypto.createHmac("sha256", secret).update(ip).digest("hex");
  }
  return crypto.createHash("sha256").update(ip).digest("hex");
}
