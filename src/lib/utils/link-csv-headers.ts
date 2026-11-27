/** A Bitly link export as downloaded; `headers` are trimmed and lower-cased. */
export const isBitlyExport = (headers: readonly string[]) =>
  !headers.includes("url") &&
  (headers.includes("destination url") || headers.includes("long url")) &&
  (headers.includes("link") || headers.includes("bitlink"));

/**
 * Column names from the start of a CSV file, read without a full parse so the
 * import dialog can tell a Bitly export apart before uploading it. Header cells
 * in the formats we accept hold no commas or line breaks.
 */
export const readCsvHeaders = (start: string) =>
  (start.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "").split(",").map((name) =>
    name
      .trim()
      .replace(/^"(.*)"$/, "$1")
      .trim()
      .toLowerCase(),
  );
