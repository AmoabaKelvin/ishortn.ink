export type ChangelogCategory = "feature" | "improvement" | "fix" | "breaking";

export interface ChangelogFrontmatter {
  date: string;
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
