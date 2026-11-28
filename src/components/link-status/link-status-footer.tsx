"use client";

import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

import {
  type MarketingCampaign,
  REPORT_ABUSE_URL,
  getSignupPageUrl,
  isPlatformHost,
} from "./utils";

const subscribe = () => () => {};

export function LinkStatusFooter({
  campaign,
  branded,
}: {
  campaign?: MarketingCampaign;
  branded?: boolean;
}) {
  // The server's answer when it has one; otherwise nothing until the browser
  // knows which host it is on, so a custom domain never flashes iShortn links.
  const isPlatform = useSyncExternalStore(
    subscribe,
    () => branded ?? isPlatformHost(window.location.host),
    () => branded ?? null,
  );

  if (isPlatform === null) return null;

  if (!isPlatform) {
    return (
      <p className="mt-6 text-[12px] text-neutral-400 dark:text-muted-foreground">
        If you believe this is a mistake, contact the owner of this link.
      </p>
    );
  }

  return (
    <div className="mt-8 flex flex-col items-center gap-3">
      {campaign && (
        <Button asChild className="rounded-lg bg-blue-600 text-[13px] text-white hover:bg-blue-700">
          <a href={getSignupPageUrl(campaign)}>Create your own free short link</a>
        </Button>
      )}
      <a
        href={REPORT_ABUSE_URL}
        className="rounded-md text-[12px] text-neutral-500 underline-offset-2 hover:text-neutral-700 hover:underline dark:text-neutral-400 dark:hover:text-neutral-300"
      >
        Report abuse
      </a>
    </div>
  );
}
