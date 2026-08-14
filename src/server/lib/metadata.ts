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

function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return match ? (match[2] ?? match[3] ?? null) : null;
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

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'");
}

export async function scrapeMetadata(url: string): Promise<ScrapedMetadata> {
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
  const fallbackFavicon = absolutize("/favicon.ico", base);

  if (!(response.headers.get("content-type") ?? "").includes("html")) {
    return { title: "", description: "", image: "", favicon: fallbackFavicon };
  }

  const html = (await response.text()).slice(0, MAX_HTML_BYTES);

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
