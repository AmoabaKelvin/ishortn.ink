import { RECIPIENT_TOKEN } from "@/emails/_components/recipient";

import type { ReactElement } from "react";

// <Preview> pads the inbox snippet with runs of non-breaking spaces and zero-width characters.
// Only runs are stripped: a single one can be real copy, such as "10\u00A0clicks" or the
// zero-width joiner inside an emoji sequence in a team or link name.
const PREVIEW_SPACERS = /[\u00A0\u200B-\u200F\uFEFF]{2,}/g;
const URL_TOKEN = /(^|[ \t]+)(https?:\/\/\S+)/gm;

/**
 * Tidies the plain-text part: strips the preview padding, and prints each URL once. A URL that
 * appears again (a button followed by "or copy this URL") keeps only its last occurrence, which
 * is the one the copy points at.
 */
export function cleanPlainText(text: string): string {
  const counts = new Map<string, number>();
  for (const [, , url = ""] of text.matchAll(URL_TOKEN)) {
    counts.set(url, (counts.get(url) ?? 0) + 1);
  }
  return text
    .replace(PREVIEW_SPACERS, "")
    .replace(URL_TOKEN, (match, _space: string, url: string) => {
      const left = (counts.get(url) ?? 1) - 1;
      counts.set(url, left);
      return left > 0 ? "" : match;
    })
    .replace(/[^\S\n]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
}

/**
 * Renders an email's HTML and plain-text parts, with the recipient's address for the footer.
 * The renderer is imported on first use, like the Resend client, so routes that only reach an
 * email helper don't load React's server renderer.
 */
export async function renderEmail(
  react: ReactElement,
  to: string,
): Promise<{ html: string; text: string }> {
  const { render, plainTextSelectors } = await import("@react-email/components");
  const [html, text] = await Promise.all([
    render(react),
    render(react, {
      plainText: true,
      htmlToTextOptions: {
        selectors: [
          ...plainTextSelectors,
          // After the defaults so these win: mailto links already show their address.
          { selector: "a", options: { linkBrackets: false, hideLinkHrefIfSameAsText: true } },
          // The logo row only repeats the brand; the footer names iShortn.
          { selector: ".email-header", format: "skip" },
        ],
      },
    }),
  ]);
  return {
    html: html.replaceAll(RECIPIENT_TOKEN, escapeHtml(to)),
    text: cleanPlainText(text.replaceAll(RECIPIENT_TOKEN, to)),
  };
}
