import crypto from "node:crypto";

import { env } from "@/env.mjs";

/**
 * Returns a 64-char hex digest of the visitor IP.
 *
 * When `IP_HASH_SECRET` is set we HMAC the IP with the secret; this prevents
 * trivial rainbow-table reversal of the hash back to an IP (plain SHA-256 of
 * an IPv4 address is brute-forceable in seconds). Existing rows hashed under
 * the old scheme remain valid — they simply stop matching new inserts, so a
 * visitor seen before the cutover is counted fresh afterwards.
 *
 * When the secret is unset, falls back to the previous SHA-256 behavior so
 * we don't break environments that haven't been updated yet.
 */
export function hashIp(ip: string): string {
  const secret = env.IP_HASH_SECRET;
  if (secret) {
    return crypto.createHmac("sha256", secret).update(ip).digest("hex");
  }
  return crypto.createHash("sha256").update(ip).digest("hex");
}
