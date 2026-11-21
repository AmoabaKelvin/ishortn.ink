import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { parseHttpUrl, parseLinkReference } from "./url.ts";

describe("parseHttpUrl", () => {
  test("accepts one http or https URL and trims surrounding whitespace", () => {
    assert.equal(parseHttpUrl("https://example.com/page?ref=1"), "https://example.com/page?ref=1");
    assert.equal(parseHttpUrl("  http://example.com\n"), "http://example.com");
    assert.equal(parseHttpUrl("https://sub.example.co.uk"), "https://sub.example.co.uk");
  });

  test("rejects empty input, other schemes and bare words", () => {
    for (const text of [
      undefined,
      null,
      "",
      "   ",
      "example.com",
      "ftp://example.com",
      "mailto:a@b.co",
      "javascript:alert(1)",
    ]) {
      assert.equal(parseHttpUrl(text), null, String(text));
    }
  });

  test("rejects hosts without a dot and text that only contains a URL", () => {
    assert.equal(parseHttpUrl("http://localhost:3000"), null);
    assert.equal(parseHttpUrl("https://example."), null);
    assert.equal(parseHttpUrl("see https://example.com"), null);
    assert.equal(parseHttpUrl("https://a.com https://b.com"), null);
  });
});

describe("parseLinkReference", () => {
  test("takes a bare alias with an optional domain", () => {
    assert.deepEqual(parseLinkReference("launch-day"), { alias: "launch-day", domain: undefined });
    assert.deepEqual(parseLinkReference(" launch-day ", " go.brand.com "), {
      alias: "launch-day",
      domain: "go.brand.com",
    });
  });

  test("reads the alias and domain from a pasted short link, with or without a scheme", () => {
    assert.deepEqual(parseLinkReference("https://isht.app/launch-day"), { alias: "launch-day", domain: "isht.app" });
    assert.deepEqual(parseLinkReference("isht.ink/launch-day/"), { alias: "launch-day", domain: "isht.ink" });
  });

  test("a domain typed in its own field wins over the short link's host", () => {
    assert.deepEqual(parseLinkReference("https://isht.app/launch-day", "go.brand.com"), {
      alias: "launch-day",
      domain: "go.brand.com",
    });
  });

  test("rejects empty input, links without an alias and nested paths", () => {
    for (const input of ["", "  ", "https://isht.app", "https://isht.app/", "https://isht.app/a/b", "a/b"]) {
      assert.equal(parseLinkReference(input), null, input);
    }
  });
});
