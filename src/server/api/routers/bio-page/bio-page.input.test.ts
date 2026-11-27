import { describe, expect, test } from "bun:test";

import { addBioBlockSchema, updateBioBlockSchema } from "./bio-page.input";

describe("WhatsApp block input", () => {
  test("accepts a WhatsApp block and normalizes the number", () => {
    const parsed = addBioBlockSchema.parse({
      bioPageId: 1,
      type: "whatsapp",
      title: "Order on WhatsApp",
      whatsapp: { phone: "+233 24 123 4567", message: "Hello" },
    });
    expect(parsed.whatsapp).toEqual({ phone: "+233241234567", message: "Hello" });
  });

  test("rejects a number that isn't E.164", () => {
    const add = addBioBlockSchema.safeParse({
      bioPageId: 1,
      type: "whatsapp",
      whatsapp: { phone: "024 123 4567" },
    });
    const update = updateBioBlockSchema.safeParse({ id: 1, whatsapp: { phone: "+0123" } });
    expect(add.success).toBe(false);
    expect(update.success).toBe(false);
  });
});
