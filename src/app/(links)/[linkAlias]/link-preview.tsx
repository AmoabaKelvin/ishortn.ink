import { IconArrowDown, IconExternalLink } from "@tabler/icons-react";
import { Funnel_Sans } from "next/font/google";

import { ShortLinkAttribution } from "@/components/link-status/short-link-attribution";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const funnelSans = Funnel_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
});

type LinkPreviewProps = {
  domain: string;
  alias: string | null;
  url: string | null;
  // Platform domain and not a cloaked link.
  branded: boolean;
};

// Server component: only reached for links that are not password protected,
// blocked, disabled or scheduled, so showing the destination is intended.
function LinkPreview({ domain, alias, url, branded }: LinkPreviewProps) {
  const shortUrl = `${domain}/${alias}`;

  return (
    <main
      className={cn(
        "flex min-h-[100dvh] items-center justify-center bg-neutral-50 px-4 py-12 dark:bg-accent/50",
        funnelSans.className,
      )}
    >
      <div className="w-full max-w-lg text-center">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl dark:text-foreground">
          Link preview
        </h1>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-pretty text-neutral-500 dark:text-neutral-400">
          Short links can lead anywhere on the internet. Check where this one goes before you
          continue.
        </p>

        <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-5 text-left dark:border-border dark:bg-card">
          <p className="text-[12px] font-medium text-neutral-400 dark:text-muted-foreground">
            Short link
          </p>
          <p className="mt-1 text-[14px] font-medium break-all text-neutral-900 dark:text-foreground">
            {shortUrl}
          </p>
          <div className="my-3 flex items-center gap-2 text-neutral-400 dark:text-muted-foreground">
            <IconArrowDown size={14} stroke={1.5} aria-hidden="true" />
            <span className="text-[12px]">Redirects to</span>
          </div>
          <p className="text-[13px] break-all text-neutral-700 dark:text-neutral-300">
            {url ?? "No destination set"}
          </p>
        </div>

        <Button
          asChild
          className="mt-6 gap-2 rounded-lg bg-blue-600 text-[13px] text-white hover:bg-blue-700"
        >
          <a href={`https://${shortUrl}`}>
            Continue to site
            <IconExternalLink size={16} stroke={2} aria-hidden="true" />
          </a>
        </Button>

        {branded && <ShortLinkAttribution campaign="preview" />}
      </div>
    </main>
  );
}

export default LinkPreview;
