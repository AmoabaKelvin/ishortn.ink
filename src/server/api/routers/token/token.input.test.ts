import { describe, expect, test } from "bun:test";

import { token } from "@/server/db/schema";

import { createTokenSchema, TOKEN_NAME_MAX_LENGTH } from "./token.input";

describe("createTokenSchema", () => {
  // A name longer than the column fails the insert with a 500 (MySQL 1406), so the
  // validation limit must never exceed it.
  test("name limit matches the Token.name column", () => {
    expect(TOKEN_NAME_MAX_LENGTH).toBe(token.name.length ?? Number.NaN);
  });

  test("accepts a name at the limit", () => {
    expect(createTokenSchema.safeParse({ name: "a".repeat(TOKEN_NAME_MAX_LENGTH) }).success).toBe(
      true,
    );
  });

  test("rejects a name over the limit with a clear message", () => {
    const result = createTokenSchema.safeParse({ name: "a".repeat(TOKEN_NAME_MAX_LENGTH + 1) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      `Name must be ${TOKEN_NAME_MAX_LENGTH} characters or less`,
    );
  });

  test("trims before checking the limit", () => {
    const result = createTokenSchema.safeParse({
      name: `  ${"a".repeat(TOKEN_NAME_MAX_LENGTH)}  `,
    });
    expect(result.success).toBe(true);
  });
});
