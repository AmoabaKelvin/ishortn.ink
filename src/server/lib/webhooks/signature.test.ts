import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { generateWebhookSecret, signWebhookPayload } from "./signature";

type Verify = (
  rawBody: string,
  header: string,
  secret: string,
  toleranceSeconds?: number,
) => boolean;

// Runs the verification snippet exactly as the docs page publishes it, so the docs can't drift
// from what deliveries send.
function documentedVerifier(): Verify {
  const docs = readFileSync(
    path.join(import.meta.dir, "../../../../content/docs/integrations/webhooks.mdx"),
    "utf8",
  );
  const snippet = docs.match(/```javascript title="Node\.js"\n([\s\S]*?)```/)?.[1];
  if (!snippet) throw new Error("Node.js verification snippet not found in the docs");
  // SAFETY: the snippet defines verifyIshortnSignature with the Verify signature.
  return new Function("require", `${snippet}\nreturn verifyIshortnSignature;`)(
    createRequire(import.meta.url),
  ) as Verify;
}

describe("webhook signatures", () => {
  const verify = documentedVerifier();
  const secret = generateWebhookSecret();
  const body = JSON.stringify({ id: "evt_1", type: "link.created", data: { alias: "é-✓" } });
  const now = Math.floor(Date.now() / 1000);

  test("the documented snippet accepts a signature we generate", () => {
    expect(verify(body, signWebhookPayload(secret, body, now), secret)).toBe(true);
  });

  test("uses the t=<unix>,v1=<hex HMAC-SHA256> format", () => {
    expect(signWebhookPayload("whsec_test", "{}", 1700000000)).toBe(
      "t=1700000000,v1=" +
        new Bun.CryptoHasher("sha256", "whsec_test").update("1700000000.{}").digest("hex"),
    );
  });

  test("the snippet rejects a changed body, another secret or an old timestamp", () => {
    const header = signWebhookPayload(secret, body, now);
    expect(verify(`${body} `, header, secret)).toBe(false);
    expect(verify(body, header, generateWebhookSecret())).toBe(false);
    expect(verify(body, signWebhookPayload(secret, body, now - 600), secret)).toBe(false);
    expect(verify(body, "garbage", secret)).toBe(false);
  });

  test("secrets are unique and prefixed", () => {
    const a = generateWebhookSecret();
    expect(a).toMatch(/^whsec_[0-9a-f]{48}$/);
    expect(a).not.toBe(generateWebhookSecret());
  });
});
