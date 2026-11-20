import { describe, expect, test } from "bun:test";

import {
  buildUnsubscribeHeaders,
  createUnsubscribeToken,
  verifyUnsubscribeToken,
} from "./unsubscribe";

const secret = "a".repeat(32);

describe("unsubscribe tokens", () => {
  test("round-trips the user id", () => {
    const token = createUnsubscribeToken("user_2abcDEF", secret);
    expect(verifyUnsubscribeToken(token, secret)).toBe("user_2abcDEF");
  });

  test("rejects a token signed with another secret or for another user", () => {
    const token = createUnsubscribeToken("user_1", secret);
    expect(verifyUnsubscribeToken(token, "b".repeat(32))).toBeNull();

    const signature = token.split(".")[1];
    expect(verifyUnsubscribeToken(`user_2.${signature}`, secret)).toBeNull();
  });

  test("rejects malformed tokens", () => {
    expect(verifyUnsubscribeToken("", secret)).toBeNull();
    expect(verifyUnsubscribeToken("no-signature", secret)).toBeNull();
    expect(verifyUnsubscribeToken(".abc", secret)).toBeNull();
  });
});

describe("buildUnsubscribeHeaders", () => {
  test("offers only the mailto without a secret", () => {
    const headers = buildUnsubscribeHeaders("user_1", undefined);
    expect(headers["List-Unsubscribe"]).toStartWith("<mailto:support@ishortn.ink");
    expect(headers).not.toHaveProperty("List-Unsubscribe-Post");
  });

  test("adds a one-click URL with a secret", () => {
    const headers = buildUnsubscribeHeaders("user_1", secret);
    const token = encodeURIComponent(createUnsubscribeToken("user_1", secret));
    expect(headers["List-Unsubscribe"]).toStartWith(
      `<https://ishortn.ink/api/email/unsubscribe?token=${token}>, <mailto:`,
    );
    expect(headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
});
