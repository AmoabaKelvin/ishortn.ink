// Embed blocks. The pasted URL is reduced to a provider and an id, and the
// iframe src is rebuilt from those on a fixed provider host, so no user-typed
// string ever becomes an iframe src. The block stores the canonical source URL
// in `url` and these details as JSON in `content` (embed-content.ts, kept apart
// so this module stays free of zod for the public page's client bundle).

export const EMBED_PROVIDERS = [
  "youtube",
  "vimeo",
  "spotify",
  "soundcloud",
  "tiktok",
  "maps",
] as const;
export type EmbedProvider = (typeof EMBED_PROVIDERS)[number];

export const EMBED_PROVIDER_LABELS = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  spotify: "Spotify",
  soundcloud: "SoundCloud",
  tiktok: "TikTok",
  maps: "Google Maps",
} satisfies Record<EmbedProvider, string>;

export type EmbedDetails = {
  provider: EmbedProvider;
  /** Provider-specific id; see ID_PATTERNS. */
  embedId: string;
  /** Title from the provider's oEmbed endpoint, when it could be fetched. */
  title?: string;
};

export type ParsedEmbed = { provider: EmbedProvider; embedId: string; sourceUrl: string };

export type EmbedParseResult = { ok: true; embed: ParsedEmbed } | { ok: false; error: string };

export const EMBED_UNSUPPORTED_MESSAGE =
  "Paste a link from YouTube, Vimeo, Spotify, SoundCloud, TikTok or Google Maps.";

const MAPS_QUERY_MAX = 300;

// Re-checked when the src is built, so a stored id can never widen what the
// iframe points at.
const ID_PATTERNS = {
  youtube: /^[\w-]{11}$/,
  vimeo: /^\d{1,12}(\/[0-9a-f]{6,20})?$/,
  spotify: /^(track|album|playlist|episode|show|artist)\/[A-Za-z0-9]{22}$/,
  soundcloud: /^[\w-]{1,100}\/(sets\/)?[\w-]{1,200}$/,
  tiktok: /^\d{8,25}$/,
  // "q:<search text>" or "pb:<the pb parameter of a Share > Embed a map URL>".
  maps: new RegExp(`^(q:[^\\n]{1,${MAPS_QUERY_MAX}}|pb:[\\w!.%~-]{1,2000})$`),
} satisfies Record<EmbedProvider, RegExp>;

function ok(provider: EmbedProvider, embedId: string, sourceUrl: string): EmbedParseResult {
  return ID_PATTERNS[provider].test(embedId)
    ? { ok: true, embed: { provider, embedId, sourceUrl } }
    : { ok: false, error: `That ${EMBED_PROVIDER_LABELS[provider]} link isn't one we can embed.` };
}

function fail(error: string): EmbedParseResult {
  return { ok: false, error };
}

const shortLink = (provider: string) =>
  `Open the ${provider} short link in your browser and paste the full URL it goes to.`;

function parseYouTube(url: URL): EmbedParseResult {
  const path = url.pathname.split("/").filter(Boolean);
  let id: string | null | undefined;
  if (url.hostname === "youtu.be") id = path[0];
  else if (path[0] === "watch") id = url.searchParams.get("v");
  else if (["shorts", "embed", "live", "v"].includes(path[0] ?? "")) id = path[1];
  if (!id) return fail("Paste the link to a YouTube video.");
  return ok("youtube", id, `https://www.youtube.com/watch?v=${id}`);
}

function parseVimeo(url: URL): EmbedParseResult {
  const path = url.pathname.split("/").filter(Boolean);
  if (["showcase", "album", "event"].includes(path[0] ?? "")) {
    return fail("Paste the link to a single Vimeo video.");
  }
  // player.vimeo.com/video/<id>?h=<hash>, vimeo.com/<id>, vimeo.com/<id>/<hash>,
  // vimeo.com/channels/<name>/<id>, vimeo.com/groups/<name>/videos/<id>.
  const idIndex = path.findIndex((segment) => /^\d+$/.test(segment));
  if (idIndex === -1) return fail("Paste the link to a Vimeo video.");
  const id = path[idIndex]!;
  const hash = url.searchParams.get("h") ?? path[idIndex + 1];
  const embedId = hash && /^[0-9a-f]{6,20}$/.test(hash) ? `${id}/${hash}` : id;
  return ok("vimeo", embedId, `https://vimeo.com/${embedId}`);
}

function parseSpotify(url: URL): EmbedParseResult {
  // Locale prefixes (/intl-de/) and the /embed/ form both resolve to the same item.
  const path = url.pathname
    .split("/")
    .filter((segment) => segment && segment !== "embed" && !segment.startsWith("intl-"));
  if (path.length < 2)
    return fail("Paste the link to a Spotify track, album, playlist or podcast.");
  const embedId = `${path[0]}/${path[1]}`;
  return ok("spotify", embedId, `https://open.spotify.com/${embedId}`);
}

// Profile sub-pages that share the /<user>/<track> shape but aren't playable.
const SOUNDCLOUD_PROFILE_PAGES = new Set([
  "tracks",
  "likes",
  "reposts",
  "albums",
  "popular-tracks",
  "followers",
  "following",
  "comments",
]);

function parseSoundCloud(url: URL): EmbedParseResult {
  const path = url.pathname.split("/").filter(Boolean);
  const isSet = path[1] === "sets";
  const parts = isSet ? path.slice(0, 3) : path.slice(0, 2);
  if (parts.length < (isSet ? 3 : 2) || (!isSet && SOUNDCLOUD_PROFILE_PAGES.has(path[1] ?? "")))
    return fail("Paste the link to a SoundCloud track or playlist.");
  const embedId = parts.join("/");
  return ok("soundcloud", embedId, `https://soundcloud.com/${embedId}`);
}

function parseTikTok(url: URL): EmbedParseResult {
  const path = url.pathname.split("/").filter(Boolean);
  // tiktok.com/@user/video/<id>, or the player/embed forms that end in the id.
  const videoIndex = path.findIndex((segment) => segment === "video" || segment === "v1");
  const id = videoIndex === -1 ? path.find((s) => /^\d{8,25}$/.test(s)) : path[videoIndex + 1];
  if (!id) return fail("Paste the link to a TikTok video.");
  const user = path[0]?.startsWith("@") ? path[0] : "@";
  return ok("tiktok", id, `https://www.tiktok.com/${user}/video/${id}`);
}

function parseMaps(url: URL): EmbedParseResult {
  const path = url.pathname.split("/").filter(Boolean);
  if (path[0] !== "maps" && url.hostname.split(".")[0] !== "maps") {
    return fail("Paste a Google Maps link.");
  }

  // searchParams decodes, but real pb values carry encoded place ids
  // (`0x…%3A0x…`) and names (`Empire%20State`), so re-encode before the
  // allow-list check and keep the iframe src exactly as Google wrote it.
  const pb = url.searchParams.get("pb");
  if (path[1] === "embed" && pb) {
    const encoded = encodeURIComponent(pb);
    return ok("maps", `pb:${encoded}`, `https://www.google.com/maps/embed?pb=${encoded}`);
  }

  // /maps/place/<name>/@lat,lng,zoom or /maps/search/<query>, else ?q= / ?query=.
  const named = path[1] === "place" || path[1] === "search" ? path[2] : undefined;
  const coords = path
    .find((s) => s.startsWith("@"))
    ?.slice(1)
    .split(",")
    .slice(0, 2)
    .join(",");
  let decoded: string | undefined;
  if (named) {
    try {
      decoded = decodeURIComponent(named.replace(/\+/g, " "));
    } catch {
      // Half-typed or broken escapes (`Caf%C3`) throw URIError.
      return fail("That doesn't look like a valid Google Maps link.");
    }
  }
  const raw = decoded || url.searchParams.get("q") || url.searchParams.get("query") || coords;
  const query = raw?.trim();
  if (!query) return fail("Paste a Google Maps link to a place or address.");
  return ok(
    "maps",
    `q:${query.slice(0, MAPS_QUERY_MAX)}`,
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
  );
}

/**
 * Turn a pasted URL (or a provider's whole `<iframe>` snippet) into an
 * allow-listed provider and id. Pure; runs on the server before storing and in
 * the editor for the inline field error.
 */
export function parseEmbedUrl(input: string): EmbedParseResult {
  let value = input.trim();
  // People often paste the provider's whole embed snippet; only its src matters.
  const iframeSrc = value.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i)?.[1];
  if (iframeSrc) value = iframeSrc.replace(/&amp;/g, "&");
  if (!value) return fail("Paste the link you want to embed.");
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fail("That doesn't look like a valid URL.");
  }

  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, "");
  if (["youtube.com", "music.youtube.com", "youtube-nocookie.com", "youtu.be"].includes(host)) {
    return parseYouTube(url);
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") return parseVimeo(url);
  if (host === "open.spotify.com") return parseSpotify(url);
  if (host === "on.soundcloud.com") return fail(shortLink("SoundCloud"));
  if (host === "soundcloud.com") return parseSoundCloud(url);
  if (host === "vm.tiktok.com" || host === "vt.tiktok.com") return fail(shortLink("TikTok"));
  if (host === "tiktok.com") return parseTikTok(url);
  if (host === "maps.app.goo.gl" || host === "goo.gl") return fail(shortLink("Google Maps"));
  if (/^(maps\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(host)) return parseMaps(url);
  return fail(EMBED_UNSUPPORTED_MESSAGE);
}

/** The iframe src for stored details, or null when they don't pass the allow-list. */
export function buildEmbedSrc({ provider, embedId }: Pick<EmbedDetails, "provider" | "embedId">) {
  if (!ID_PATTERNS[provider]?.test(embedId)) return null;
  switch (provider) {
    case "youtube":
      return `https://www.youtube-nocookie.com/embed/${embedId}?autoplay=1&playsinline=1&rel=0`;
    case "vimeo": {
      const [id, hash] = embedId.split("/");
      return `https://player.vimeo.com/video/${id}?autoplay=1${hash ? `&h=${hash}` : ""}`;
    }
    case "spotify":
      return `https://open.spotify.com/embed/${embedId}`;
    case "soundcloud":
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(
        `https://soundcloud.com/${embedId}`,
      )}&auto_play=true&visual=false`;
    case "tiktok":
      return `https://www.tiktok.com/player/v1/${embedId}?autoplay=1&rel=0`;
    case "maps":
      return embedId.startsWith("pb:")
        ? `https://www.google.com/maps/embed?pb=${embedId.slice(3)}`
        : `https://maps.google.com/maps?q=${encodeURIComponent(embedId.slice(2))}&output=embed`;
  }
}

/**
 * The frame's shape, shared by the facade and the iframe so loading the player
 * never shifts the page. Players with a fixed control height get `height`;
 * video and maps keep an aspect ratio.
 */
export function embedFrameSize({
  provider,
  embedId,
}: Pick<EmbedDetails, "provider" | "embedId">): { aspect: string } | { height: number } {
  switch (provider) {
    case "spotify":
      return { height: /^(track|episode)\//.test(embedId) ? 152 : 352 };
    case "soundcloud":
      return { height: embedId.includes("/sets/") ? 352 : 166 };
    case "tiktok":
      return { aspect: "9 / 16" };
    case "maps":
      return { aspect: "4 / 3" };
    default:
      return { aspect: "16 / 9" };
  }
}

/** Short fallback title when neither the block nor the provider has one. */
export function embedFallbackTitle({
  provider,
  embedId,
}: Pick<EmbedDetails, "provider" | "embedId">) {
  switch (provider) {
    case "spotify":
      return `Spotify ${embedId.split("/")[0]}`;
    case "soundcloud":
      return embedId.includes("/sets/") ? "SoundCloud playlist" : "SoundCloud track";
    case "maps":
      return embedId.startsWith("q:") ? embedId.slice(2) : "Map";
    default:
      return `${EMBED_PROVIDER_LABELS[provider]} video`;
  }
}

// oEmbed endpoints for providers that publish one (Google Maps has none).
const OEMBED_ENDPOINTS = {
  youtube: "https://www.youtube.com/oembed?format=json&url=",
  vimeo: "https://vimeo.com/api/oembed.json?url=",
  spotify: "https://open.spotify.com/oembed?url=",
  soundcloud: "https://soundcloud.com/oembed?format=json&url=",
  tiktok: "https://www.tiktok.com/oembed?url=",
  maps: null,
} satisfies Record<EmbedProvider, string | null>;

export function oembedUrl(embed: Pick<ParsedEmbed, "provider" | "sourceUrl">): string | null {
  const endpoint = OEMBED_ENDPOINTS[embed.provider];
  return endpoint ? `${endpoint}${encodeURIComponent(embed.sourceUrl)}` : null;
}
