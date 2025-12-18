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
      const dateValue = data.date;
      const dateString = dateValue instanceof Date
        ? dateValue.toISOString().split("T")[0]
        : String(dateValue);

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
  lastViewedDate: string | null
): Promise<ChangelogEntry[]> {
  const entries = await getChangelogEntries();

  if (!lastViewedDate) {
    return entries;
  }

  const lastViewed = new Date(lastViewedDate);
  return entries.filter((entry) => new Date(entry.date) > lastViewed);
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
