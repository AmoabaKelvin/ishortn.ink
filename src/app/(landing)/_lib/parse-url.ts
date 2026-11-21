// Comfortably under the byte capacity of a version-40 QR code at error level M (2,331), and a
// length every browser and analytics tool handles.
export const MAX_URL_LENGTH = 2000;

export type ParsedUrlResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Turns what someone typed into a public http(s) URL. A missing scheme defaults to https so
 * "example.com" works; anything that is not a public-looking http(s) URL is rejected. Shared by
 * the free landing tools so they all accept the same input.
 */
export const parseUrl = (
  input: string,
  messages: { empty?: string; tooLong?: string } = {},
): ParsedUrlResult => {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: messages.empty ?? "Enter a URL." };
  if (trimmed.length > MAX_URL_LENGTH) {
    return {
      ok: false,
      error:
        messages.tooLong ??
        `That URL is too long. Keep it under ${MAX_URL_LENGTH.toLocaleString()} characters.`,
    };
  }

  // "example.com:8080" has no scheme: a scheme is never followed by a port number.
  const withScheme = /^[a-z][a-z\d+.-]*:(?!\d)/i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, error: "Enter a valid URL, like https://example.com." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Only http and https links are supported." };
  }
  // A dot-less host ("https://hello") parses but resolves nowhere for the person clicking.
  if (!url.hostname.includes(".") || url.hostname.endsWith(".")) {
    return { ok: false, error: "Enter a valid URL, like https://example.com." };
  }

  return { ok: true, url: withScheme };
};
