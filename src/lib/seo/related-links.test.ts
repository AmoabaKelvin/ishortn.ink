import { describe, expect, it } from "bun:test";
import fs from "fs";
import path from "path";

import matter from "gray-matter";

import { visibleRelatedLinks } from "./related-links";

const slug = "qr-code-for-restaurant-menu";
const { date } = matter(
  fs.readFileSync(path.join(process.cwd(), "content/blog", `${slug}.md`), "utf8"),
).data;
const postDate = date instanceof Date ? date.toISOString().slice(0, 10) : String(date);
const dayBefore = new Date(`${postDate}T12:00:00Z`);
dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);

const links = [
  { href: `/blog/${slug}`, label: "Post" },
  { href: "/blog/no-such-post", label: "Missing post" },
  { href: "/docs/qr-codes", label: "Docs" },
];

describe("visibleRelatedLinks", () => {
  it("hides a blog post until its date", () => {
    expect(visibleRelatedLinks(links, dayBefore).map((l) => l.href)).toEqual(["/docs/qr-codes"]);
  });

  it("shows a blog post from its date on", () => {
    const onTheDay = new Date(`${postDate}T00:00:00Z`);
    expect(visibleRelatedLinks(links, onTheDay).map((l) => l.href)).toEqual([
      `/blog/${slug}`,
      "/docs/qr-codes",
    ]);
  });
});
