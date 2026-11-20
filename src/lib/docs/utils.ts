import GithubSlugger from "github-slugger";

export type DocsHeading = { depth: 2 | 3; text: string; id: string };

export type DocsSearchRecord = {
  href: string;
  page: string;
  section: string;
  heading?: string;
  text: string;
};

type SearchSection = { heading?: string; id?: string; lines: string[] };

const FENCE = /^\s*(```|~~~)/;

// Inline markdown to the text rehype-slug sees, so ids match the rendered headings.
function inlineText(markdown: string): string {
  return markdown
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/(\*\*|__|\*|_)(\S(?:.*?\S)?)\1/g, "$2")
    .trim();
}

/** Lines of an MDX body outside fenced code blocks. */
function proseLines(body: string): string[] {
  const lines: string[] = [];
  let inFence = false;
  for (const line of body.split("\n")) {
    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) lines.push(line);
  }
  return lines;
}

/** h2/h3 headings with the ids rehype-slug assigns, for the table of contents. */
export function extractHeadings(body: string): DocsHeading[] {
  const slugger = new GithubSlugger();
  const headings: DocsHeading[] = [];
  for (const line of proseLines(body)) {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const text = inlineText(match[2]!);
    // Every heading advances the slugger (rehype-slug numbers duplicates across
    // all levels), but only h2/h3 go in the table of contents.
    const id = slugger.slug(text);
    const depth = match[1]!.length;
    if (depth === 2 || depth === 3) headings.push({ depth, text, id });
  }
  return headings;
}

function plainText(lines: string[]): string {
  return lines
    .filter((line) => !/^\s*(<|import |export |\|\s*-)/.test(line))
    .map((line) => inlineText(line.replace(/^\s*([>*-]|\d+\.)\s+/, "").replaceAll("|", " ")))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Splits a page into one search record per h2/h3 section, plus the page intro. */
export function buildSearchRecords(
  page: { href: string; title: string; section: string; description: string },
  body: string,
): DocsSearchRecord[] {
  const slugger = new GithubSlugger();
  const records: DocsSearchRecord[] = [];
  let current: SearchSection = { lines: [page.description] };

  const flush = () => {
    records.push({
      href: current.id ? `${page.href}#${current.id}` : page.href,
      page: page.title,
      section: page.section,
      heading: current.heading,
      text: plainText(current.lines),
    });
  };

  for (const line of proseLines(body)) {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) {
      current.lines.push(line);
      continue;
    }
    const text = inlineText(match[2]!);
    const id = slugger.slug(text);
    if (match[1]!.length > 3) {
      current.lines.push(text);
      continue;
    }
    flush();
    current = { heading: text, id, lines: [] } satisfies SearchSection;
  }
  flush();
  return records;
}

/**
 * Ranks records for a query: every term must appear somewhere; matches in the
 * page title and heading outrank body matches.
 */
export function searchDocs(
  records: DocsSearchRecord[],
  query: string,
  limit = 12,
): DocsSearchRecord[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const scored: { record: DocsSearchRecord; score: number }[] = [];
  for (const record of records) {
    const title = record.page.toLowerCase();
    const heading = record.heading?.toLowerCase() ?? "";
    const text = record.text.toLowerCase();
    let score = 0;
    for (const term of terms) {
      const inTitle = title.includes(term);
      const inHeading = heading.includes(term);
      const inText = text.includes(term);
      if (!inTitle && !inHeading && !inText) {
        score = 0;
        break;
      }
      score += (inHeading ? 4 : 0) + (inTitle ? 3 : 0) + (inText ? 1 : 0);
    }
    if (score > 0) scored.push({ record, score });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.record);
}

/** A short excerpt of `text` around the first query term. */
export function searchExcerpt(text: string, query: string, length = 120): string {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const lower = text.toLowerCase();
  const hit = terms.map((term) => lower.indexOf(term)).find((index) => index >= 0) ?? 0;
  const start = Math.max(0, hit - 30);
  const excerpt = text.slice(start, start + length).trim();
  return `${start > 0 ? "…" : ""}${excerpt}${start + length < text.length ? "…" : ""}`;
}
