// Comfortably under the byte capacity of a version-40 QR code at error level M (2,331).
export const MAX_QR_URL_LENGTH = 2000;

export type QrUrlResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Turns what someone typed into the URL a static QR code should encode. A missing scheme
 * defaults to https so "example.com" works; anything that is not a public-looking http(s)
 * URL is rejected so the preview never shows a code that opens nothing.
 */
export const parseQrUrl = (input: string): QrUrlResult => {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Enter a URL to generate a QR code." };
  if (trimmed.length > MAX_QR_URL_LENGTH) {
    return {
      ok: false,
      error: `That URL is too long for a QR code. Keep it under ${MAX_QR_URL_LENGTH.toLocaleString()} characters.`,
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
  // A dot-less host ("https://hello") parses but resolves nowhere for the person scanning.
  if (!url.hostname.includes(".") || url.hostname.endsWith(".")) {
    return { ok: false, error: "Enter a valid URL, like https://example.com." };
  }

  return { ok: true, url: withScheme };
};
