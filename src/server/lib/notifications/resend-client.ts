import { env } from "@/env.mjs";

import type { Resend } from "resend";

let client: Promise<Resend | null> | undefined;

/**
 * The Resend client, or null without an API key. The SDK is imported on first use: it statically
 * imports React's server renderer, which every route reaching an email helper (API auth, workspace
 * context) would otherwise load on its first request in each isolate.
 */
export function getResend(): Promise<Resend | null> {
  const apiKey = env.RESEND_API_KEY;
  client ??= apiKey
    ? import("resend").then(({ Resend }) => new Resend(apiKey))
    : Promise.resolve(null);
  return client;
}
