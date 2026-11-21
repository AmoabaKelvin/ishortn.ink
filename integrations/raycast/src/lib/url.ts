/**
 * Returns the text as a URL when it is exactly one http(s) URL with a dotted
 * host, else null. Text that merely contains a URL (a sentence, a list) is not
 * taken, so the extension never shortens something the user didn't mean.
 */
export function parseHttpUrl(text: string | undefined | null): string | null {
  const candidate = text?.trim();
  if (!candidate || /\s/.test(candidate)) return null;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname.includes(".") || url.hostname.endsWith(".")) return null;
  return candidate;
}

export type LinkReference = { alias: string; domain?: string };

/**
 * Reads the alias field of Link Analytics, which takes either a bare alias
 * ("launch-day") or a pasted short link ("https://isht.app/launch-day"). A
 * domain typed in its own field wins over the short link's host.
 */
export function parseLinkReference(aliasInput: string, domainInput?: string): LinkReference | null {
  const domain = domainInput?.trim() || undefined;
  const input = aliasInput.trim();
  if (!input) return null;

  const shortLink = parseHttpUrl(input.includes("://") ? input : `https://${input}`);
  if (shortLink && input.includes("/")) {
    const url = new URL(shortLink);
    const alias = url.pathname.replace(/^\/+|\/+$/g, "");
    if (!alias || alias.includes("/")) return null;
    return { alias, domain: domain ?? url.hostname };
  }

  if (input.includes("/")) return null;
  return { alias: input, domain };
}
