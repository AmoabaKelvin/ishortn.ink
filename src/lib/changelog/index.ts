import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";
import gfm from "remark-gfm";
import type {
  ChangelogEntry,
  ChangelogFrontmatter,
  ChangelogManifest,
} from "./types";

const changelogsDirectory = path.join(process.cwd(), "content/changelogs");

export async function getChangelogEntries(): Promise<ChangelogEntry[]> {
  if (!fs.existsSync(changelogsDirectory)) {
    return [];
  }

  const fileNames = fs.readdirSync(changelogsDirectory);
  const markdownFiles = fileNames.filter((name) => name.endsWith(".md"));

  const entries = await Promise.all(
    markdownFiles.map(async (fileName) => {
      const slug = fileName.replace(/\.md$/, "");
      const fullPath = path.join(changelogsDirectory, fileName);
      const fileContents = fs.readFileSync(fullPath, "utf8");

      const { data, content } = matter(fileContents);

      // Ensure date is a string (gray-matter may parse it as a Date object)
      // Supports both date-only (2025-12-18) and datetime (2025-12-18T14:30:00) formats
      const dateValue = data.date;
      let dateString: string;
      if (dateValue instanceof Date) {
        dateString = dateValue.toISOString();
      } else {
        const strValue = String(dateValue);
        // If it's just a date (no time component), append T00:00:00 for consistent sorting
        dateString = strValue.includes("T") ? strValue : `${strValue}T00:00:00`;
      }

      const processedContent = await remark().use(gfm).use(html).process(content);
      const htmlContent = processedContent.toString();

      return {
        slug,
        content,
        htmlContent,
        date: dateString,
        version: String(data.version),
        title: String(data.title),
        shortDesc: String(data.shortDesc),
        category: data.category as ChangelogEntry["category"],
      } as ChangelogEntry;
    })
  );

  return entries.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export async function getChangelogManifest(): Promise<ChangelogManifest> {
  const entries = await getChangelogEntries();

  if (entries.length === 0) {
    return {
      entries: [],
      latestVersion: "0.0.0",
      latestDate: new Date().toISOString().split("T")[0] as string,
    };
  }

  const latestEntry = entries[0]!;
  return {
    entries,
    latestVersion: latestEntry.version,
    latestDate: latestEntry.date,
  };
}

export async function getChangelogEntriesSince(
  lastViewedSlug: string | null
): Promise<ChangelogEntry[]> {
  const entries = await getChangelogEntries();

  if (!lastViewedSlug) {
    return entries;
  }

  // Find the index of the last viewed entry by slug
  const lastViewedIndex = entries.findIndex((entry) => entry.slug === lastViewedSlug);

  // If the slug is not found, return all entries (edge case: deleted changelog)
  if (lastViewedIndex === -1) {
    return entries;
  }

  // Return all entries that are newer (have a lower index since entries are sorted newest first)
  return entries.slice(0, lastViewedIndex);
}

export async function getLatestChangelog(): Promise<ChangelogEntry | null> {
  const entries = await getChangelogEntries();
  return entries[0] || null;
}

export {
  type ChangelogEntry,
  type ChangelogFrontmatter,
  type ChangelogManifest,
  type ChangelogCategory,
} from "./types";
