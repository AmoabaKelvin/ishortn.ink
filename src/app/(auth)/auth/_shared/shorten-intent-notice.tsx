import { IconCornerDownRight } from "@tabler/icons-react";

import { DEFAULT_PLATFORM_DOMAIN } from "@/lib/constants/domains";
import { cn } from "@/lib/utils";

import { cardClass } from "../../../(landing)/_components/site-primitives";

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

// Sign-up's start step on the intent path: our heading in place of Clerk's, which
// site-auth.css hides under [data-shorten-intent] as the placeholder leaves it out,
// so the placeholder and the mounted form keep the same height.
export function ShortenIntentHeading() {
  return (
    <div data-start-step-only className="mb-6 flex flex-col gap-1 text-center">
      <h1 className="text-balance font-title text-2xl font-semibold tracking-[-0.035em] text-neutral-900">
        Get your short link
      </h1>
      <p className="text-pretty text-base text-neutral-600">
        Create a free account and we&apos;ll make it right away.
      </p>
    </div>
  );
}

// The link a visitor asked to shorten, as a card above the sign-up card. `url`
// as for ShortenIntentNotice. Only the short link's domain: its alias doesn't
// exist until sign-up ends.
export function PendingLinkCard({ url, showNote }: { url: string; showNote: boolean }) {
  return (
    <section aria-label="Your link" className={cn(cardClass, "mb-4 p-5")}>
      <p className="text-sm font-medium text-neutral-500">Your link</p>
      <p className="mt-1 break-all text-base font-medium text-neutral-900">
        <bdi className="ph-no-capture">{url}</bdi>
      </p>
      <p className="mt-1 flex items-center gap-1.5 font-mono text-sm text-neutral-500">
        <IconCornerDownRight aria-hidden="true" className="size-4 shrink-0" />
        <span className="sr-only">Short link on</span>
        {DEFAULT_PLATFORM_DOMAIN}/…
      </p>
      {showNote && (
        <p
          data-start-step-only
          className="mt-4 text-pretty border-t border-neutral-950/[0.07] pt-4 text-base text-neutral-600 sm:text-sm"
        >
          Free account required to create and track it. Takes a few seconds with Google.
        </p>
      )}
    </section>
  );
}
