import { describe, expect, test } from "bun:test";

import { createLinkSchema, updateLinkSchema } from "./link.input";

describe("link alias input", () => {
  const url = "https://example.com";

  // Link.alias is varchar(255): a longer alias must fail validation, not the insert.
  test("rejects an alias longer than 255 characters", () => {
    const alias = "a".repeat(256);
    const created = createLinkSchema.safeParse({ url, alias });
    expect(created.success).toBe(false);
    expect(created.error?.issues[0]?.message).toBe("Aliases can be at most 255 characters");
    expect(updateLinkSchema.safeParse({ id: 1, alias }).success).toBe(false);
  });

  test("accepts a 255-character alias", () => {
    const alias = "a".repeat(255);
    expect(createLinkSchema.safeParse({ url, alias }).success).toBe(true);
    expect(updateLinkSchema.safeParse({ id: 1, alias }).success).toBe(true);
  });
});
