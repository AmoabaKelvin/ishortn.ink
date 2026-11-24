// One line above the Clerk card restating the link the visitor asked for.
// `url` is the display label from formatShortenIntentForDisplay, rendered as
// text; kept out of autocaptured events like the UTM builder's inputs.
export function ShortenIntentNotice({ lead, url }: { lead: string; url: string }) {
  return (
    <p className="mb-6 text-pretty text-center text-base text-neutral-600 sm:text-sm">
      {lead} <bdi className="ph-no-capture break-words font-medium text-neutral-900">{url}</bdi>
    </p>
  );
}
