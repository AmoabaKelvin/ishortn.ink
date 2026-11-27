import { describe, expect, test } from "bun:test";

import { isBitlyExport, readCsvHeaders } from "./link-csv-headers";

describe("readCsvHeaders", () => {
  test("reads the first row, dropping a BOM, quotes and case", () => {
    expect(readCsvHeaders('\uFEFF"Title", Link ,Destination URL\r\na,b,c\r\n')).toEqual([
      "title",
      "link",
      "destination url",
    ]);
  });

  test("returns one empty name for an empty file", () => {
    expect(readCsvHeaders("")).toEqual([""]);
  });
});

describe("isBitlyExport", () => {
  test("recognises the current and the older Bitly export", () => {
    expect(isBitlyExport(readCsvHeaders("Title,Link,Custom Link,Destination URL"))).toBe(true);
    expect(isBitlyExport(readCsvHeaders("Bitlink,Custom Bitlink,Long URL"))).toBe(true);
  });

  test("treats a file with a url column as our own format", () => {
    expect(isBitlyExport(readCsvHeaders("url,alias,title"))).toBe(false);
    expect(isBitlyExport(readCsvHeaders("url,link,destination url"))).toBe(false);
  });
});
