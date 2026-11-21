import { describe, expect, test } from "bun:test";

import { parseLinkCsv } from "@/server/api/routers/link/utils";

import { convertDataToCSV } from "./convert-links-to-csv";

const exported = (url: string, note: string | null = null) => ({
  createdAt: new Date("2026-11-20T10:00:00.000Z"),
  url,
  alias: "my-alias",
  domain: "ishortn.ink",
  note,
});

describe("convertDataToCSV", () => {
  test("writes a header row and leaves plain fields unquoted", () => {
    expect(convertDataToCSV([exported("https://a.example")])).toBe(
      "createdAt,url,alias,domain,note\r\n2026-11-20T10:00:00.000Z,https://a.example,my-alias,ishortn.ink,\r\n",
    );
  });

  test("quotes fields with commas, quotes and line breaks", () => {
    const csv = convertDataToCSV([exported('https://a.example/?q="x",y', "one\ntwo\r\nthree")]);
    expect(csv).toContain('"https://a.example/?q=""x"",y"');
    expect(csv).toContain('"one\ntwo\r\nthree"');
  });

  test("round-trips through the CSV importer", () => {
    const links = [
      exported("https://a.example/page#section"),
      exported('https://b.example/?tags=a,b&q="quoted"', 'note, with "quotes"\nand a newline'),
      exported("https://c.example/#/route?x=1", null),
    ];

    expect(parseLinkCsv(convertDataToCSV(links))).toEqual([
      {
        row: 2,
        url: "https://a.example/page#section",
        alias: "my-alias",
        domain: "ishortn.ink",
        note: undefined,
      },
      {
        row: 3,
        url: 'https://b.example/?tags=a,b&q="quoted"',
        alias: "my-alias",
        domain: "ishortn.ink",
        note: 'note, with "quotes"\nand a newline',
      },
      {
        row: 4,
        url: "https://c.example/#/route?x=1",
        alias: "my-alias",
        domain: "ishortn.ink",
        note: undefined,
      },
    ]);
  });
});
