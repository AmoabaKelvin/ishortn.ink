import { env } from "@/env.mjs";

import {
  type FeedKind,
  type LinkIndex,
  matchFeedEntry,
  parsePlainFeedLine,
  parseUrlhausCsvLine,
  type RescanMatch,
  type RescanSource,
} from "./utils";

type Feed = {
  source: RescanSource;
  kind: FeedKind;
  /** Null when the feed needs a key that isn't configured. */
  url: string | null;
  parseLine: (line: string) => string | null;
};

const PHISHING_DATABASE_BASE =
  "https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master";

// The links feed is ~65 MB, so feeds are streamed line by line against the in-memory link index
// rather than loaded whole.
const FEED_TIMEOUT_MS = 120_000;

export function getFeeds(): Feed[] {
  const urlhausKey = env.URLHAUS_AUTH_KEY;
  return [
    {
      source: "phishing-database-links",
      kind: "url",
      url: `${PHISHING_DATABASE_BASE}/phishing-links-ACTIVE.txt`,
      parseLine: parsePlainFeedLine,
    },
    {
      source: "phishing-database-domains",
      kind: "domain",
      url: `${PHISHING_DATABASE_BASE}/phishing-domains-ACTIVE.txt`,
      parseLine: parsePlainFeedLine,
    },
    {
      source: "openphish",
      kind: "url",
      url: "https://openphish.com/feed.txt",
      parseLine: parsePlainFeedLine,
    },
    {
      // abuse.ch retired the keyless text_online download; the keyed export carries a status column.
      source: "urlhaus",
      kind: "url",
      url: urlhausKey
        ? `https://urlhaus-api.abuse.ch/v2/files/exports/${encodeURIComponent(urlhausKey)}/recent.csv`
        : null,
      parseLine: parseUrlhausCsvLine,
    },
  ];
}

export async function* readLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffered = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffered += value;
    const lines = buffered.split("\n");
    buffered = lines.pop() ?? "";
    yield* lines;
  }
  if (buffered) yield buffered;
}

export type FeedScanResult = { entries: number; matches: RescanMatch[]; error?: string };

/**
 * Streams one feed and returns the links it matches. Lines are independent, so if the stream
 * breaks part-way the matches found so far are kept alongside the error.
 */
export async function scanFeed(feed: Feed, index: LinkIndex): Promise<FeedScanResult> {
  const result: FeedScanResult = { entries: 0, matches: [] };
  if (!feed.url) return { ...result, error: "not configured" };

  try {
    const response = await fetch(feed.url, {
      headers: { "User-Agent": "ishortn-phishing-rescan" },
      signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
    });
    if (!response.ok || !response.body) {
      return { ...result, error: `HTTP ${response.status}` };
    }

    for await (const line of readLines(response.body)) {
      const entry = feed.parseLine(line);
      if (!entry) continue;
      result.entries++;
      result.matches.push(...matchFeedEntry(index, feed.source, feed.kind, entry));
    }
    return result;
  } catch (error) {
    return { ...result, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
