import fs from "fs";
import path from "path";

type BundledMarkdown = Record<string, { default: string }>;

// Markdown under content/ keyed by file name without `.md`. The Worker has no filesystem, so code
// that runs there (ISR revalidation, tRPC) can't read content/ at request time: `bundled` must be
// an eager `import.meta.glob(..., { query: "?raw" })` so Turbopack inlines the files at build time
// (see the `?raw` rule in next.config.js). bun test has no import.meta.glob and reads the disk.
export function loadMarkdownSources(
  directory: string,
  bundled: () => BundledMarkdown,
): Map<string, string> {
  const slug = (filePath: string) => path.basename(filePath, ".md");

  if (process.env.NODE_ENV === "test") {
    const fullPath = path.join(process.cwd(), directory);
    return new Map(
      fs
        .readdirSync(fullPath)
        .filter((name) => name.endsWith(".md"))
        .map((name) => [slug(name), fs.readFileSync(path.join(fullPath, name), "utf8")]),
    );
  }

  // Turbopack's `import: "default"` glob option resolves to undefined for these modules, so read
  // `.default` here.
  return new Map(
    Object.entries(bundled()).map(([filePath, module]) => [slug(filePath), module.default]),
  );
}
