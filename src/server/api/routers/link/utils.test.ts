import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { db } from "@/server/db";

import {
  clicksToCsv,
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

  test("reads a title (or name) column as the link name", () => {
    expect(
      parseLinkCsv(`url,alias,title\nhttps://a.example,a, Spring sale \nhttps://b.example,b,`),
    ).toEqual([
      { row: 2, url: "https://a.example", alias: "a", name: "Spring sale" },
      { row: 3, url: "https://b.example", alias: "b", name: undefined },
    ]);
    expect(parseLinkCsv(`url,Name\nhttps://a.example,${"x".repeat(300)}`)[0]?.name).toBe(
      "x".repeat(255),
    );
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

describe("parseLinkCsv with a Bitly export", () => {
  const fixture = (name: string) =>
    readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");

  test("maps each row of the current export", () => {
    const rows = parseLinkCsv(fixture("bitly-export-current.csv"));
    expect(rows[0]).toEqual({
      row: 2,
      url: "https://example.com/menu/spring?utm_source=print",
      domain: "go.example.com",
      alias: "spring-menu",
      name: "Spring menu, dinner",
      note: "Imported from Bitly: https://go.example.com/3XCetqn",
      bitly: {
        shortLink: "https://go.example.com/spring-menu",
        custom: true,
        code: "3XCetqn",
        deleted: false,
      },
    });
    expect(rows[1]).toMatchObject({
      domain: "go.example.com",
      alias: "3XABUQI",
      bitly: { custom: false, code: undefined },
    });
    expect(rows[2]).toMatchObject({
      domain: "bit.ly",
      alias: "example-reviews",
      bitly: { code: "4aBcDeF" },
    });
    expect(rows[3]?.name).toBeUndefined();
    expect(rows[4]?.bitly?.deleted).toBe(true);
    expect(rows).toHaveLength(7);
  });

  test("reads the legacy export, whose Status column may be empty", () => {
    const rows = parseLinkCsv(fixture("bitly-export-legacy.csv"));
    expect(rows.map((row) => [row.domain, row.alias, row.bitly?.code, row.bitly?.deleted])).toEqual(
      [
        ["go.example.com", "FAQ", "3vLl4Ax", false],
        ["go.example.com", "3GexGSC", undefined, false],
      ],
    );
    expect(rows[1]?.url).toBe("https://example.com/connect?utm_source=email");
  });

  test("keeps the back-half's path for alias validation and flags unreadable links", () => {
    const rows = parseLinkCsv(
      [
        "link,destination url",
        "https://Go.Example.com/a/b/,https://a.example",
        "not a link,https://b.example",
        "https://go.example.com/,https://c.example",
      ].join("\n"),
    );
    expect(rows[0]).toMatchObject({ domain: "go.example.com", alias: "a/b" });
    expect(rows[1]?.bitly?.error).toBe("This row has no valid Bitly link");
    expect(rows[2]?.bitly?.error).toBe("This row has no valid Bitly link");
  });

  test("keeps no separate code when it matches the custom back-half or sits on another domain", () => {
    const rows = parseLinkCsv(
      [
        "Link,Custom Link,Destination URL",
        "https://go.example.com/faq,https://go.example.com/FAQ,https://a.example",
        "https://bit.ly/abc,https://go.example.com/faq,https://b.example",
      ].join("\n"),
    );
    expect(rows.map((row) => row.bitly?.code)).toEqual([undefined, undefined]);
  });

  test("caps the title and note at the column width", () => {
    const [row] = parseLinkCsv(
      `Link,Title,Destination URL\nhttps://bit.ly/${"a".repeat(300)},${"t".repeat(300)},https://a.example`,
    );
    expect(row?.name).toHaveLength(255);
    expect(row?.note).toHaveLength(255);
  });

  test("prefers the generic format when a url column is present", () => {
    expect(parseLinkCsv("url,link,destination url\nhttps://a.example,x,y")).toEqual([
      { row: 2, url: "https://a.example", alias: undefined, domain: undefined, note: undefined },
    ]);
  });

  test("names both accepted formats when neither matches", () => {
    expect(() => parseLinkCsv("link,title\nhttps://bit.ly/a,x")).toThrow(
      'The first row must be a header with a "url" column, or a link export from Bitly ("Link" and "Destination URL" columns).',
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
    for (const alias of [
      "utm-builder",
      "url-expander",
      "qr-code-generator",
      "whatsapp-link-generator",
      "gerador-de-link-whatsapp",
      "social",
      "mcp",
      "Pricing",
    ]) {
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
    expect(() => validateAlias({ db }, "mcp", "ishortn.ink", true)).toThrow(
      "This alias is reserved. Choose another one.",
    );
  });
});

describe("clicksToCsv", () => {
  const row = {
    createdAt: new Date("2026-11-23T14:05:09.123Z"),
    domain: "ishortn.ink",
    alias: "launch",
    url: "https://example.com/?a=1,2",
    country: "GH",
    city: null,
    device: "Mobile",
    browser: "Chrome",
    os: "Android",
    referer: "twitter",
  };

  test("writes the header and one quoted line per click", () => {
    expect(clicksToCsv([row])).toBe(
      "Timestamp (UTC),Short link,Destination,Country,City,Device,Browser,OS,Referrer\r\n" +
        '"2026-11-23 14:05:09","https://ishortn.ink/launch","https://example.com/?a=1,2","GH","","Mobile","Chrome","Android","X"\r\n',
    );
  });

  test("labels missing referrers as Direct", () => {
    expect(clicksToCsv([{ ...row, referer: null }])).toEndWith('"Direct"\r\n');
  });

  test("escapes quotes and neutralises spreadsheet formulas", () => {
    const csv = clicksToCsv([{ ...row, url: '=HYPERLINK("x")', city: "-1+1" }]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain(`"'-1+1"`);
  });

  test("an empty export is just the header", () => {
    expect(clicksToCsv([]).split("\r\n")).toEqual([
      "Timestamp (UTC),Short link,Destination,Country,City,Device,Browser,OS,Referrer",
      "",
    ]);
  });
});
