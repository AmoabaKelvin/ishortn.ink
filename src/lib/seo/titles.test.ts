import { describe, expect, it } from "bun:test";
import fs from "fs";
import path from "path";

import matter from "gray-matter";

import { APP_TITLE } from "@/lib/constants/app";

import { comparisonTitle, competitors } from "./competitors";
import { solutionList, solutionsHubTitle } from "./solutions";

// Search results cut titles off at about 60 characters.
const MAX_TITLE_LENGTH = 60;
// Mirrors the root layout's `%s | iShortn` title template.
const templated = (title: string) => `${title} | ${APP_TITLE}`;
const brandCount = (title: string) => title.split(APP_TITLE).length - 1;

describe("page titles", () => {
  it("keeps comparison titles short with the brand once", () => {
    const titles = Object.values(competitors).map(comparisonTitle);
    for (const title of titles) {
      expect(title.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
      expect(brandCount(title)).toBe(1);
    }
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("keeps solution titles short with the brand once", () => {
    const titles = [solutionsHubTitle, ...solutionList.map((solution) => solution.metaTitle)];
    for (const title of titles) {
      expect(title.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
      expect(brandCount(title)).toBe(1);
    }
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("keeps the compare hub title short", () => {
    const title = templated("Link shortener comparison: free plans and prices");
    expect(title.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
  });

  it("frames link-in-bio competitors as a link in bio comparison", () => {
    expect(comparisonTitle(competitors.beacons)).toBe("Beacons vs iShortn: link in bio comparison");
  });

  it("uses a competitor's seoTitle when it has one", () => {
    expect(comparisonTitle(competitors["short-io"])).toBe(
      "Short.io vs iShortn: Pricing and Free Plan Compared (2026)",
    );
    expect(comparisonTitle(competitors.bitly)).toBe(
      "Bitly vs iShortn: Free Plan, Pricing and Migration (2026)",
    );
    expect(comparisonTitle(competitors.linktree)).toBe(
      "Linktree vs iShortn: Custom Domain, Analytics and Price",
    );
    expect(comparisonTitle(competitors.dub)).toBe(
      "Dub.co vs iShortn: Pricing and Free Plan Compared (2026)",
    );
    expect(comparisonTitle(competitors.tinyurl)).toBe(
      "TinyURL vs iShortn: Free Click Tracking and Pricing (2026)",
    );
    expect(comparisonTitle(competitors.rebrandly)).toBe(
      "Rebrandly vs iShortn: Free Plan and Custom Domains (2026)",
    );
  });

  it("keeps blog post titles short with the brand once", () => {
    // Reads frontmatter only: getAllPosts renders every post's markdown, which is too slow here.
    const blogDirectory = path.join(process.cwd(), "content/blog");
    const posts = fs
      .readdirSync(blogDirectory)
      .filter((name) => /\.mdx?$/.test(name))
      .map((name) => matter(fs.readFileSync(path.join(blogDirectory, name), "utf8")).data)
      .filter((data) => data.published !== false);
    expect(posts.length).toBeGreaterThan(0);
    const titles = posts.map((data) => templated(String(data.seoTitle ?? data.title)));
    for (const title of titles) {
      expect(title.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
      expect(brandCount(title)).toBe(1);
    }
    expect(new Set(titles).size).toBe(titles.length);
  });
});
