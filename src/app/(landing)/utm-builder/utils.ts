import { Paths } from "@/lib/constants/app";

import { parseUrl } from "../_lib/parse-url";

export const UTM_FIELDS = ["source", "medium", "campaign", "content", "term", "id"] as const;
export type UtmField = (typeof UTM_FIELDS)[number];
export type UtmValues = {
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;
  id: string;
};

export const EMPTY_UTM_VALUES = {
  source: "",
  medium: "",
  campaign: "",
  content: "",
  term: "",
  id: "",
} satisfies UtmValues;

export const MAX_BULK_URLS = 1000;

const UTM_PARAM_NAMES = new Set<string>(UTM_FIELDS.map((field) => `utm_${field}`));
const TOOL_UTM = "utm_source=ishortn&utm_medium=tool&utm_campaign=utm-builder";

/** Lowercase, underscores for whitespace, no repeated underscores: GA4 values are case-sensitive. */
export const cleanUtmValue = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, "_").replace(/_+/g, "_");

export const prepareUtmValue = (value: string, clean: boolean): string =>
  clean ? cleanUtmValue(value) : value.trim();

const decodeParamName = (pair: string): string => {
  const name = pair.split("=")[0] ?? "";
  try {
    return decodeURIComponent(name.replace(/\+/g, " ")).toLowerCase();
  } catch {
    return name.toLowerCase();
  }
};

/**
 * The input URL with its utm_* parameters replaced by `values`, in a fixed order. Other query
 * parameters keep their order and original encoding, and the fragment stays last. Returns null
 * when the input isn't a valid URL.
 */
export const buildTaggedUrl = (input: string, values: UtmValues, clean = true): string | null => {
  const parsed = parseUrl(input);
  if (!parsed.ok) return null;

  const url = new URL(parsed.url);
  const { search, hash } = url;
  url.search = "";
  url.hash = "";

  const kept = search
    .slice(1)
    .split("&")
    .filter((pair) => pair !== "" && !UTM_PARAM_NAMES.has(decodeParamName(pair)));
  const tags = UTM_FIELDS.flatMap((field) => {
    const value = prepareUtmValue(values[field], clean);
    return value ? [`utm_${field}=${encodeURIComponent(value)}`] : [];
  });
  const query = [...kept, ...tags].join("&");

  return `${url.href}${query ? `?${query}` : ""}${hash}`;
};

/** The utm_* values already present in a URL, for pre-filling the form. */
export const readUtmParams = (input: string): Partial<UtmValues> => {
  const parsed = parseUrl(input);
  if (!parsed.ok) return {};
  const params = new URL(parsed.url).searchParams;
  const found: Partial<UtmValues> = {};
  for (const field of UTM_FIELDS) {
    const value = params.get(`utm_${field}`)?.trim();
    if (value) found[field] = value;
  }
  return found;
};

export type BulkLink = { url: string; original: string };
export type BulkResult =
  | { ok: true; links: BulkLink[]; invalidLines: number[] }
  | { ok: false; error: string };

/** Tags every non-blank line. Invalid lines are skipped and reported by 1-based line number. */
export const buildBulk = (text: string, values: UtmValues, clean = true): BulkResult => {
  const lines = text.split(/\r?\n/);
  const nonBlank = lines.reduce((count, line) => (line.trim() ? count + 1 : count), 0);
  if (nonBlank > MAX_BULK_URLS) {
    return { ok: false, error: `Paste up to ${MAX_BULK_URLS.toLocaleString()} URLs at a time.` };
  }

  const links: BulkLink[] = [];
  const invalidLines: number[] = [];
  lines.forEach((line, index) => {
    const original = line.trim();
    if (!original) return;
    const url = buildTaggedUrl(original, values, clean);
    if (url) links.push({ url, original });
    else invalidLines.push(index + 1);
  });
  return { ok: true, links, invalidLines };
};

const csvField = (value: string): string =>
  /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

/** RFC 4180 CSV with the `url` and `note` columns the dashboard CSV import reads. */
export const toCsv = (links: BulkLink[]): string =>
  ["url,note", ...links.map((link) => `${csvField(link.url)},${csvField(link.original)}`)].join(
    "\r\n",
  );

/** Where "Shorten this link" goes: straight to the editor when signed in, else via sign-up. */
export const getShortenHref = (output: string | null, signedIn: boolean | null): string => {
  if (signedIn) {
    return output ? `/dashboard/link/new?url=${encodeURIComponent(output)}` : "/dashboard/link/new";
  }
  return output
    ? `${Paths.Signup}?url=${encodeURIComponent(output)}&${TOOL_UTM}`
    : `${Paths.Signup}?${TOOL_UTM}`;
};

export const getBulkSignupHref = (signedIn: boolean | null): string =>
  signedIn ? Paths.Dashboard : `${Paths.Signup}?${TOOL_UTM}&utm_content=bulk`;

export const FEATURES_SIGNUP_HREF = `${Paths.Signup}?${TOOL_UTM}&utm_content=features`;
