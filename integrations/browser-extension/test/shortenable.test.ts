import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { displayUrl, isShortenableUrl, normalizePastedUrl } from "../src/lib/shortenable.ts";

describe("isShortenableUrl", () => {
  it("accepts http and https pages", () => {
    assert.equal(isShortenableUrl("https://example.com/a?b=c#d"), true);
    assert.equal(isShortenableUrl("http://localhost:3000/"), true);
    assert.equal(isShortenableUrl("https://chrome.google.com/search"), true);
  });

  it("rejects browser-internal and local schemes", () => {
    for (const url of [
      "chrome://extensions/",
      "edge://settings",
      "about:blank",
      "about:newtab",
      "file:///Users/me/doc.pdf",
      "moz-extension://abc/popup.html",
      "chrome-extension://abc/popup.html",
      "view-source:https://example.com",
      "data:text/html,hi",
      "javascript:alert(1)",
    ]) {
      assert.equal(isShortenableUrl(url), false, url);
    }
  });

  it("rejects extension store pages", () => {
    assert.equal(isShortenableUrl("https://chromewebstore.google.com/detail/abc"), false);
    assert.equal(isShortenableUrl("https://chrome.google.com/webstore/detail/abc"), false);
    assert.equal(isShortenableUrl("https://addons.mozilla.org/en-US/firefox/addon/x/"), false);
    assert.equal(isShortenableUrl("https://microsoftedge.microsoft.com/addons/detail/x"), false);
  });

  it("rejects empty and invalid values", () => {
    assert.equal(isShortenableUrl(""), false);
    assert.equal(isShortenableUrl(undefined), false);
    assert.equal(isShortenableUrl(null), false);
    assert.equal(isShortenableUrl("not a url"), false);
  });
});

describe("normalizePastedUrl", () => {
  it("adds https:// when the scheme is missing", () => {
    assert.equal(normalizePastedUrl("  example.com/page "), "https://example.com/page");
  });

  it("keeps http(s) URLs", () => {
    assert.equal(normalizePastedUrl("http://example.com"), "http://example.com/");
  });

  it("rejects other schemes, spaces and bare words", () => {
    assert.equal(normalizePastedUrl("ftp://example.com"), null);
    assert.equal(normalizePastedUrl("javascript:alert(1)"), null);
    assert.equal(normalizePastedUrl("hello world"), null);
    assert.equal(normalizePastedUrl("hello"), null);
    assert.equal(normalizePastedUrl(""), null);
  });
});

describe("displayUrl", () => {
  it("drops the scheme and trailing slash", () => {
    assert.equal(displayUrl("https://ishortn.ink/abc"), "ishortn.ink/abc");
    assert.equal(displayUrl("https://example.com/"), "example.com");
    assert.equal(displayUrl("https://example.com/a?b=1"), "example.com/a?b=1");
  });
});
