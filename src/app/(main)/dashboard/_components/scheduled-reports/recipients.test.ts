import { describe, expect, test } from "bun:test";

import { parseRecipients } from "./recipients";

describe("parseRecipients", () => {
  test("splits on commas, semicolons, spaces and new lines, lowercased and de-duplicated", () => {
    expect(parseRecipients("Ama@Example.com, kofi@example.com;\nama@example.com  b@x.io")).toEqual({
      emails: ["ama@example.com", "kofi@example.com", "b@x.io"],
    });
  });

  test("needs at least one address", () => {
    expect(parseRecipients(" ,\n ")).toEqual({ error: "Add at least one email address" });
  });

  test("names the first invalid address", () => {
    expect(parseRecipients("ama@example.com, not-an-email")).toEqual({
      error: "not-an-email isn't a valid email address",
    });
  });

  test("takes up to 5", () => {
    const five = ["a", "b", "c", "d", "e"].map((name) => `${name}@x.io`);
    expect(parseRecipients(five.join(","))).toEqual({ emails: five });
    expect(parseRecipients([...five, "f@x.io"].join(","))).toEqual({
      error: "Add up to 5 email addresses",
    });
  });
});
