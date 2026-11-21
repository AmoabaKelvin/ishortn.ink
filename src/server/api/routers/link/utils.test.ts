import { describe, expect, test } from "bun:test";

import { db } from "@/server/db";

import {
  countsTowardMonthlyLinkQuota,
  escapeLikePattern,
  isAppRouteAlias,
  MAX_CSV_IMPORT_CHARS,
  MAX_CSV_IMPORT_ROWS,
  parseLinkCsv,
  settleWithConcurrency,
  validateAlias,
} from "./utils";

describe("monthly link quota", () => {
  test("regular short links and QR tracking links count toward the quota on every plan", () => {
    for (const plan of ["free", "pro", "ultra"] as const) {
      expect(countsTowardMonthlyLinkQuota(plan, {})).toBe(true);
      expect(countsTowardMonthlyLinkQuota(plan, { isBioLink: false })).toBe(true);
      expect(countsTowardMonthlyLinkQuota(plan, { isBioLink: null })).toBe(true);
    }
  });

  test("free bio link blocks don't count toward the quota", () => {
    expect(countsTowardMonthlyLinkQuota("free", { isBioLink: true })).toBe(false);
  });

  test("paid bio link blocks still count toward the quota", () => {
    expect(countsTowardMonthlyLinkQuota("pro", { isBioLink: true })).toBe(true);
    expect(countsTowardMonthlyLinkQuota("ultra", { isBioLink: true })).toBe(true);
  });
});

describe("parseLinkCsv", () => {
  test("matches headers in any case, strips a BOM and reads quoted fields", () => {
    const rows = parseLinkCsv(
      '\uFEFF URL ,ALIAS,Domain,note\r\n"https://a.example/?q=1,2#top",my-alias,,"say ""hi"""\r\n',
    );
    expect(rows).toEqual([
      {
        row: 2,
        url: "https://a.example/?q=1,2#top",
        alias: "my-alias",
        domain: undefined,
        note: 'say "hi"',
      },
    ]);
  });

  test("numbers rows as a spreadsheet does and skips blank rows", () => {
    const rows = parseLinkCsv(
      'url,note\r\n\r\nhttps://a.example,"one\r\ntwo"\r\n,,\r\nhttps://b.example\r\n',
    );
    expect(rows.map((row) => [row.row, row.url])).toEqual([
      [3, "https://a.example"],
      [5, "https://b.example"],
    ]);
  });

  test("accepts rows with missing trailing columns", () => {
    expect(parseLinkCsv("url,alias,domain\nhttps://a.example")).toEqual([
      { row: 2, url: "https://a.example", alias: undefined, domain: undefined, note: undefined },
    ]);
  });

  test("refuses files without a url header", () => {
    expect(() => parseLinkCsv("https://a.example,alias\n")).toThrow('"url" column');
    expect(() => parseLinkCsv("")).toThrow('"url" column');
  });

  test("refuses header-only files", () => {
    expect(() => parseLinkCsv("url,alias\n")).toThrow("no links to import");
  });

  test("turns parser errors into a message with the line number", () => {
    expect(() => parseLinkCsv('url\nhttps://a.example\n"https://b.example"x\n')).toThrow(
      "Couldn't read line 3 of the file: a quote is not closed",
    );
  });

  test("refuses oversized files", () => {
    const tooManyRows = [
      "url",
      ...Array.from({ length: MAX_CSV_IMPORT_ROWS + 1 }, () => "https://a.example"),
    ];
    expect(() => parseLinkCsv(tooManyRows.join("\n"))).toThrow("Import up to 1,000 at a time");
    expect(() => parseLinkCsv(`url\n${"a".repeat(MAX_CSV_IMPORT_CHARS)}`)).toThrow(
      "larger than 1 MB",
    );
  });
});

describe("settleWithConcurrency", () => {
  test("keeps input order, settles failures and never exceeds the limit", async () => {
    let inFlight = 0;
    let peak = 0;
    const results = await settleWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5 - n));
      inFlight--;
      if (n === 3) throw new Error("three");
      return n * 10;
    });

    expect(peak).toBe(2);
    expect(results.map((r) => (r.status === "fulfilled" ? r.value : "rejected"))).toEqual([
      10,
      20,
      "rejected",
      40,
      50,
    ]);
  });
});

describe("escapeLikePattern", () => {
  test("escapes LIKE wildcards and the escape character", () => {
    expect(escapeLikePattern("50%_off\\now")).toBe("50\\%\\_off\\\\now");
    expect(escapeLikePattern("plain-text")).toBe("plain-text");
  });
});

describe("reserved app route aliases", () => {
  test("app route names are reserved on platform domains, in any case", () => {
    for (const alias of ["utm-builder", "qr-code-generator", "Pricing"]) {
      expect(isAppRouteAlias(alias, "ishortn.ink")).toBe(true);
    }
    expect(isAppRouteAlias("my-launch", "ishortn.ink")).toBe(false);
  });

  test("app route names stay available on custom domains", () => {
    expect(isAppRouteAlias("utm-builder", "go.example.com")).toBe(false);
  });

  test("validateAlias rejects them before looking up the alias", () => {
    // Throws synchronously, before the database is queried.
    expect(() => validateAlias({ db }, "utm-builder", "ishortn.ink", true)).toThrow(
      "This alias is reserved. Choose another one.",
    );
  });
});
