import { describe, expect, test } from "bun:test";

import { shortenLinkSchema } from "@/app/api/v1/links/create";

import { qrcodeUpdateInput } from "../qrcode/qrcode.input";
import { createLinkSchema, updateLinkSchema } from "./link.input";

const url = "https://example.com";

const issues = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

describe("link input length limits", () => {
  test("createLinkSchema rejects a name, note or alias longer than its column", () => {
    const result = createLinkSchema.safeParse({
      url,
      name: "n".repeat(300),
      note: "n".repeat(300),
      alias: "a".repeat(21),
      domain: `${"d".repeat(252)}.com`,
    });

    expect(issues(result)).toEqual([
      "Link name can be at most 255 characters",
      "Alias can be at most 20 characters",
      "Domain can be at most 255 characters",
      "Note can be at most 255 characters",
    ]);
  });

  test("createLinkSchema accepts values at the limit", () => {
    const result = createLinkSchema.safeParse({
      url,
      name: "n".repeat(255),
      note: "n".repeat(255),
      alias: "a".repeat(20),
    });

    expect(result.success).toBe(true);
  });

  test("updateLinkSchema rejects a long name and note", () => {
    const result = updateLinkSchema.safeParse({
      id: 1,
      name: "n".repeat(300),
      note: "n".repeat(300),
    });

    expect(issues(result)).toEqual([
      "Link name can be at most 255 characters",
      "Note can be at most 255 characters",
    ]);
    expect(updateLinkSchema.safeParse({ id: 1, alias: "a".repeat(21) }).success).toBe(false);
  });

  test("the API and QR code inputs share the limits", () => {
    expect(issues(shortenLinkSchema.safeParse({ url, alias: "a".repeat(21) }))).toEqual([
      "Alias can be at most 20 characters",
    ]);
    expect(
      issues(qrcodeUpdateInput.safeParse({ id: 1, title: "t".repeat(256), note: "n".repeat(256) })),
    ).toEqual(["Title must be 255 characters or fewer", "Note can be at most 255 characters"]);
  });
});
