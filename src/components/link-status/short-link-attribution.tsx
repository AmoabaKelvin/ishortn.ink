import { type MarketingCampaign, getSignupUrl } from "./utils";

/**
 * Quiet iShortn credit for visitor pages a short link passes through (password,
 * preview, verified redirect). Callers render it only on platform domains and
 * never for cloaked links, so customer-branded links stay unbranded.
 */
export function ShortLinkAttribution({ campaign }: { campaign: MarketingCampaign }) {
  return (
    <p className="mt-8 text-center text-[12px] text-neutral-400 dark:text-muted-foreground">
      Short link by iShortn &middot;{" "}
      <a
        href={getSignupUrl(campaign)}
        className="rounded-md text-neutral-500 underline-offset-2 hover:text-neutral-700 hover:underline dark:text-neutral-400 dark:hover:text-neutral-300"
      >
        Create your free link
      </a>
    </p>
  );
}
