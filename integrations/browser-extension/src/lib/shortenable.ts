const STORE_HOSTS: Array<{ host: string; pathPrefix?: string }> = [
  { host: "chrome.google.com", pathPrefix: "/webstore" },
  { host: "chromewebstore.google.com" },
  { host: "addons.mozilla.org" },
  { host: "microsoftedge.microsoft.com", pathPrefix: "/addons" },
];

/**
 * Whether the current tab can be shortened. Browsers block extensions on their own stores,
 * and internal schemes (chrome://, about:, file:, …) aren't reachable for anyone else.
 */
export const isShortenableUrl = (raw: string | null | undefined): raw is string => {
  if (!raw) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (!url.hostname) return false;
  const host = url.hostname.toLowerCase();
  return !STORE_HOSTS.some(
    (store) => host === store.host && (!store.pathPrefix || url.pathname.startsWith(store.pathPrefix)),
  );
};

/**
 * Normalises a pasted link: trims it and assumes https:// when the scheme is missing.
 * Returns null when the result still isn't an http(s) URL with a dotted host or localhost.
 */
export const normalizePastedUrl = (input: string): string | null => {
  const trimmed = input.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
  return url.toString();
};

/** Short display form of a URL: host + path, without the scheme or a trailing slash. */
export const displayUrl = (raw: string): string => {
  try {
    const url = new URL(raw);
    const rest = `${url.pathname}${url.search}${url.hash}`.replace(/\/$/, "");
    return `${url.host}${rest}`;
  } catch {
    return raw;
  }
};
