export type ScrapedMetadata = {
  title: string;
  description: string;
  image: string;
  favicon: string;
};

const FETCH_TIMEOUT_MS = 8_000;
// YouTube buries its OG tags past the first ~600KB of inline script.
const MAX_HTML_BYTES = 2_000_000;

const BLOCKED_HOSTS = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[?::1)/i;

// The name must follow whitespace (so `type` doesn't match inside `data-type`), and values may be
// unquoted, as minified HTML often leaves them.
function attr(tag: string, name: string): string | null {
  const match = tag.match(
    new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\`]+))`, "i"),
  );
  return match ? (match[1] ?? match[2] ?? match[3] ?? null) : null;
}

function findMeta(html: string, keys: string[]): string | null {
  for (const tag of html.match(/<meta\s[^>]*>/gi) ?? []) {
    const key = attr(tag, "property") ?? attr(tag, "name");
    if (key && keys.includes(key.toLowerCase())) {
      const content = attr(tag, "content");
      if (content) return content;
    }
  }
  return null;
}

function absolutize(href: string | null, base: string): string {
  if (!href) return "";
  try {
    return new URL(href, base).toString();
  } catch {
    return "";
  }
}

const NAMED_ENTITIES = new Map([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["apos", "'"],
]);

// One pass, so "&amp;lt;" stays "&lt;" instead of being decoded twice.
export function decodeEntities(text: string): string {
  return text.replace(
    /&(?:#(\d+)|#x([0-9a-f]+)|(amp|lt|gt|quot|apos));/gi,
    (match, dec: string | undefined, hex: string | undefined, name: string | undefined) => {
      if (name) return NAMED_ENTITIES.get(name.toLowerCase()) ?? match;
      const code = dec ? Number.parseInt(dec, 10) : Number.parseInt(hex ?? "", 16);
      const valid = code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff);
      return valid ? String.fromCodePoint(code) : "\uFFFD";
    },
  );
}

function supportedEncoding(label: string | null | undefined): string | null {
  if (!label) return null;
  try {
    return new TextDecoder(label.trim()).encoding;
  } catch {
    return null;
  }
}

function bomEncoding(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return "utf-8";
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return "utf-16be";
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return "utf-16le";
  return null;
}

function metaEncoding(bytes: Uint8Array): string | null {
  // Charset labels are ASCII, so any ASCII-compatible decoding finds them.
  const head = new TextDecoder("windows-1252").decode(bytes.subarray(0, 1024));
  for (const tag of head.match(/<meta\s[^>]*>/gi) ?? []) {
    const label = tag.match(/charset\s*=\s*["']?\s*([\w.:-]+)/i)?.[1];
    const encoding = supportedEncoding(label);
    if (!encoding) continue;
    // A page that could be read as ASCII to find this tag isn't really UTF-16;
    // the HTML spec maps that declaration to UTF-8.
    return encoding.startsWith("utf-16") ? "utf-8" : encoding;
  }
  return null;
}

/** Charset from the Content-Type header, then the BOM, then a <meta> tag, then UTF-8. */
export function detectCharset(bytes: Uint8Array, contentType: string | null): string {
  const headerLabel = contentType?.match(/charset\s*=\s*["']?([^"';\s]+)/i)?.[1];
  return supportedEncoding(headerLabel) ?? bomEncoding(bytes) ?? metaEncoding(bytes) ?? "utf-8";
}

export function decodeHtml(bytes: Uint8Array, contentType: string | null): string {
  return new TextDecoder(detectCharset(bytes, contentType)).decode(bytes);
}

async function readCapped(response: Response, maxBytes: number): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = value.subarray(0, maxBytes - total);
    chunks.push(chunk);
    total += chunk.length;
  }
  await reader.cancel().catch(() => {});

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

type FetchedPage = {
  response: Response;
  /** Final URL after redirects. */
  base: string;
  /** Null when the response isn't HTML. */
  html: string | null;
};

async function fetchPage(url: string): Promise<FetchedPage> {
  const target = new URL(url);
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error("only http(s) URLs are supported");
  }
  if (BLOCKED_HOSTS.test(target.hostname)) {
    throw new Error("host not allowed");
  }

  const response = await fetch(target, {
    headers: {
      // Sites gate their OG tags on link-preview crawlers; a plain browser UA
      // gets a consent wall or JS shell from e.g. YouTube, while Wikipedia
      // blocks "facebookexternalhit". The Twitterbot token passes both.
      "User-Agent": "Mozilla/5.0 (compatible; iShortn/1.0; +https://ishortn.ink) Twitterbot/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  const base = response.url || target.toString();
  const contentType = response.headers.get("content-type");
  if (!(contentType ?? "").includes("html")) {
    await response.body?.cancel().catch(() => {});
    return { response, base, html: null };
  }
  const html = decodeHtml(await readCapped(response, MAX_HTML_BYTES), contentType);
  return { response, base, html };
}

function parseMetadata(html: string | null, base: string): ScrapedMetadata {
  const fallbackFavicon = absolutize("/favicon.ico", base);
  if (html === null) {
    return { title: "", description: "", image: "", favicon: fallbackFavicon };
  }

  const title =
    findMeta(html, ["og:title", "twitter:title"]) ??
    html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ??
    "";
  const description =
    findMeta(html, ["og:description", "twitter:description", "description"]) ?? "";
  const image = findMeta(html, ["og:image", "twitter:image"]);

  let favicon: string | null = null;
  for (const tag of html.match(/<link\s[^>]*>/gi) ?? []) {
    const rel = attr(tag, "rel")?.toLowerCase() ?? "";
    if (rel === "icon" || rel === "shortcut icon" || rel === "apple-touch-icon") {
      favicon = attr(tag, "href");
      if (rel !== "apple-touch-icon") break;
    }
  }

  return {
    title: decodeEntities(title),
    description: decodeEntities(description),
    image: absolutize(image, base),
    favicon: absolutize(favicon, base) || fallbackFavicon,
  };
}

export async function scrapeMetadata(url: string): Promise<ScrapedMetadata> {
  const { base, html } = await fetchPage(url);
  return parseMetadata(html, base);
}

/** What the phishing check reads from a page beyond its preview metadata. */
export type PageSignals = {
  status: number;
  /** URL the request ended on after redirects. */
  finalUrl: string;
  hasPasswordInput: boolean;
  /** A text, email or tel field (somewhere to type an email or username), or a prefilled hidden one. */
  hasEmailInput: boolean;
  /** Hosts that the page's forms submit to. */
  formActionHosts: string[];
  /** Start of the page's visible text, whitespace collapsed. */
  visibleText: string;
  imageAlts: string[];
  /** A bot-challenge interstitial (Cloudflare "Just a moment...") rather than the page itself. */
  isChallenge: boolean;
};

export type ScrapedPage = { metadata: ScrapedMetadata; signals: PageSignals };

const VISIBLE_TEXT_CHARS = 500;
const MAX_LIST_ITEMS = 10;
const MAX_ALT_CHARS = 100;

const CHALLENGE_TITLES = /^(just a moment\.*|attention required!?(\s*\|\s*cloudflare)?)$/i;
// Only on the interstitial itself: ordinary Cloudflare-proxied pages also load
// "/cdn-cgi/challenge-platform/" bot-detection scripts, so that path proves nothing.
const CHALLENGE_MARKERS = /cf[-_]chl/i;
const IDENTITY_FIELD = /e-?mail|user|login|account/i;
// Fields that can take an email or username; `search` is left out so a site search box beside a
// protected post's password field doesn't read as a sign-in form.
const TEXT_ENTRY_TYPES = new Set(["text", "email", "tel"]);

function inputTags(html: string): string[] {
  return html.match(/<input\b[^>]*>/gi) ?? [];
}

function visibleText(html: string): string {
  const text = html
    .replace(/<(head|script|style|noscript|template|svg)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ");
  return decodeEntities(text).replace(/\s+/g, " ").trim().slice(0, VISIBLE_TEXT_CHARS);
}

function parsePageSignals(
  html: string | null,
  base: string,
  status: number,
  headers: Headers,
): PageSignals {
  const inputs = html === null ? [] : inputTags(html);
  const typeOf = (tag: string) => attr(tag, "type")?.trim().toLowerCase() ?? "text";

  const formActionHosts = new Set<string>();
  for (const tag of html?.match(/<form\b[^>]*>/gi) ?? []) {
    const action = absolutize(attr(tag, "action"), base);
    const host = action ? new URL(action).hostname : "";
    if (host) formActionHosts.add(host);
  }

  const imageAlts = new Set<string>();
  for (const tag of html?.match(/<img\b[^>]*>/gi) ?? []) {
    const alt = decodeEntities(attr(tag, "alt") ?? "").trim();
    if (alt) imageAlts.add(alt.slice(0, MAX_ALT_CHARS));
  }

  const title = html?.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "";
  return {
    status,
    finalUrl: base,
    hasPasswordInput: inputs.some((tag) => typeOf(tag) === "password"),
    hasEmailInput: inputs.some((tag) => {
      const type = typeOf(tag);
      // Form builders give fields generated names ("_u123"), so any free-text field counts.
      if (TEXT_ENTRY_TYPES.has(type)) return true;
      // Kits that prefill the victim's address from the URL often carry it in a hidden field.
      if (type !== "hidden") return false;
      const names = ["name", "id", "autocomplete"].map((key) => attr(tag, key));
      return names.some((value) => value && IDENTITY_FIELD.test(value));
    }),
    formActionHosts: [...formActionHosts].slice(0, MAX_LIST_ITEMS),
    visibleText: html === null ? "" : visibleText(html),
    imageAlts: [...imageAlts].slice(0, MAX_LIST_ITEMS),
    isChallenge:
      headers.get("cf-mitigated") === "challenge" ||
      CHALLENGE_TITLES.test(decodeEntities(title).trim()) ||
      (html !== null && CHALLENGE_MARKERS.test(html)),
  };
}

export function parseScrapedPage(
  html: string | null,
  base: string,
  status: number,
  headers: Headers,
): ScrapedPage {
  return {
    metadata: parseMetadata(html, base),
    signals: parsePageSignals(html, base, status, headers),
  };
}

/**
 * The page's preview metadata plus the signals the phishing check needs. Same fetch and limits as
 * `scrapeMetadata`, which link previews keep using unchanged.
 */
export async function scrapePageForSafetyCheck(url: string): Promise<ScrapedPage> {
  const { response, base, html } = await fetchPage(url);
  return parseScrapedPage(html, base, response.status, response.headers);
}
