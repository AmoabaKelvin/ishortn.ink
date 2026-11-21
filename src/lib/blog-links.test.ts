import { describe, expect, it } from "bun:test";
import fs from "fs";
import path from "path";

// Blog CTAs to ishortn.ink carry one UTM scheme so blog signups report as a single channel.
// New posts link as https://ishortn.ink/auth/sign-up?utm_source=blog&utm_medium=content&utm_campaign=<post slug>.
const BLOG_SOURCE = "blog";
const BLOG_MEDIUM = "content";

const MARKDOWN_LINK = /\]\((https?:\/\/[^)\s]+)\)/g;

describe("blog CTA links", () => {
  it("tag every ishortn.ink link with the blog UTM scheme and the post slug", () => {
    const blogDirectory = path.join(process.cwd(), "content/blog");
    const files = fs.readdirSync(blogDirectory).filter((name) => name.endsWith(".md"));
    expect(files.length).toBeGreaterThan(0);

    let checked = 0;
    for (const file of files) {
      const slug = file.replace(/\.md$/, "");
      const source = fs.readFileSync(path.join(blogDirectory, file), "utf8");
      for (const [, href] of source.matchAll(MARKDOWN_LINK)) {
        const url = new URL(href);
        if (url.hostname.replace(/^www\./, "") !== "ishortn.ink") continue;
        checked++;
        const utm = {
          link: `${file}: ${href}`,
          source: url.searchParams.get("utm_source"),
          medium: url.searchParams.get("utm_medium"),
          campaign: url.searchParams.get("utm_campaign"),
        };
        expect(utm).toEqual({
          link: utm.link,
          source: BLOG_SOURCE,
          medium: BLOG_MEDIUM,
          campaign: slug,
        });
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
