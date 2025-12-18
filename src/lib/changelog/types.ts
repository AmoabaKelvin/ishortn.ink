export type ChangelogCategory = "feature" | "improvement" | "fix" | "breaking";

export interface ChangelogFrontmatter {
  date: string; // ISO datetime string (e.g., "2025-12-18T14:30:00" or "2025-12-18")
  version: string;
  title: string;
  shortDesc: string;
  category: ChangelogCategory;
}

export interface ChangelogEntry extends ChangelogFrontmatter {
  slug: string;
  content: string;
  htmlContent: string;
}

export interface ChangelogManifest {
  entries: ChangelogEntry[];
  latestVersion: string;
  latestDate: string;
}
