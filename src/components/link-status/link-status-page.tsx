import { Funnel_Sans } from "next/font/google";

import { cn } from "@/lib/utils";

import { LinkStatusFooter } from "./link-status-footer";

import type { MarketingCampaign } from "./utils";
import type { ReactNode } from "react";

// The root not-found page renders this component, so a preload here would put Funnel Sans on
// every route, marketing and docs included.
const funnelSans = Funnel_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
  preload: false,
});

const TONES = {
  red: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
  neutral: "bg-neutral-100 text-neutral-500 dark:bg-muted dark:text-neutral-400",
} as const;

type LinkStatusPageProps = {
  icon: ReactNode;
  tone: keyof typeof TONES;
  title: string;
  description: string;
  details?: { label: string; value: string };
  // Homepage link shown on platform domains; omitted on custom domains.
  campaign?: MarketingCampaign;
  // Server-known branding (from the request host). Left unset where reading
  // headers would make the route dynamic (the root not-found boundary).
  branded?: boolean;
};

/**
 * Visitor-facing page for a short link that can't be followed. Platform
 * domains get iShortn branding and a tagged sign-up link; a customer's own
 * domain gets a neutral page with no iShortn marketing.
 */
export function LinkStatusPage({
  icon,
  tone,
  title,
  description,
  details,
  campaign,
  branded,
}: LinkStatusPageProps) {
  return (
    <main
      className={cn(
        "flex min-h-[100dvh] items-center justify-center bg-neutral-50 px-4 py-12 dark:bg-accent/50",
        funnelSans.className,
      )}
    >
      <div className="w-full max-w-md text-center">
        <div
          className={cn(
            "mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full",
            TONES[tone],
          )}
        >
          {icon}
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-balance text-neutral-900 dark:text-foreground">
          {title}
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-pretty text-neutral-500 dark:text-neutral-400">
          {description}
        </p>

        {details && (
          <div className="mt-5 rounded-lg border border-neutral-200 bg-white px-4 py-3 dark:border-border dark:bg-card">
            <p className="text-[12px] font-medium text-neutral-400 dark:text-muted-foreground">
              {details.label}
            </p>
            <p className="mt-1 text-[13px] break-words text-neutral-700 dark:text-neutral-300">
              {details.value}
            </p>
          </div>
        )}

        <LinkStatusFooter campaign={campaign} branded={branded} />
      </div>
    </main>
  );
}
