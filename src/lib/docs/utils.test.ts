import { describe, expect, test } from "bun:test";

import { buildSearchRecords, extractHeadings, searchDocs, searchExcerpt } from "./utils";

const body = `
Intro paragraph about **links**.

## Create a link

Use \`POST\` to create one.

\`\`\`bash
## not a heading
\`\`\`

### The \`alias\` field

Details.

## Create a link

Duplicate heading.
`;

describe("extractHeadings", () => {
  test("returns h2/h3 with rehype-slug ids and skips fenced code", () => {
    expect(extractHeadings(body)).toEqual([
      { depth: 2, text: "Create a link", id: "create-a-link" },
      { depth: 3, text: "The alias field", id: "the-alias-field" },
      { depth: 2, text: "Create a link", id: "create-a-link-1" },
    ]);
  });
});

describe("buildSearchRecords", () => {
  const records = buildSearchRecords(
    { href: "/docs/api", title: "API", section: "API reference", description: "The API." },
    body,
  );

  test("creates an intro record and one per heading, linked by anchor", () => {
    expect(records.map((record) => record.href)).toEqual([
      "/docs/api",
      "/docs/api#create-a-link",
      "/docs/api#the-alias-field",
      "/docs/api#create-a-link-1",
    ]);
    expect(records[0]?.text).toBe("The API. Intro paragraph about links.");
  });

  test("searchDocs requires every term and ranks heading matches first", () => {
    const results = searchDocs(records, "alias field");
    expect(results[0]?.heading).toBe("The alias field");
    expect(searchDocs(records, "alias missingterm")).toEqual([]);
    expect(searchDocs(records, "   ")).toEqual([]);
  });
});

describe("searchExcerpt", () => {
  test("centres on the first match and marks truncation", () => {
    const text = `${"a ".repeat(40)}needle ${"b ".repeat(80)}`;
    const excerpt = searchExcerpt(text, "needle", 40);
    expect(excerpt.startsWith("…")).toBe(true);
    expect(excerpt).toContain("needle");
    expect(excerpt.endsWith("…")).toBe(true);
  });
});
