import { z } from "zod";

export const changelogCategorySchema = z.enum(["new", "improved", "fixed", "shipped"]);

export type ChangelogCategory = z.infer<typeof changelogCategorySchema>;

export const changelogFrontmatterSchema = z.object({
  // gray-matter yields a Date for unquoted datetimes and a string for quoted ones.
  // Date-only strings get T00:00:00 appended for consistent sorting.
  date: z.union([z.date(), z.string()]).transform((value) => {
    if (value instanceof Date) return value.toISOString();
    return value.includes("T") ? value : `${value}T00:00:00`;
  }),
  version: z.string(),
  title: z.string(),
  shortDesc: z.string(),
  category: changelogCategorySchema,
});

export type ChangelogFrontmatter = z.infer<typeof changelogFrontmatterSchema>;

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
