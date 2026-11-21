"use client";

import Link from "next/link";

import { trackUpgradeClick } from "@/lib/analytics/upgrade-prompt";

type UpgradeTextProps = {
  text?: string;
  /** Where the prompt sits, for upgrade-click analytics. */
  source: string;
};

/** Inline upgrade link for use inside a sentence. */
function UpgradeText({ text, source }: UpgradeTextProps) {
  return (
    <Link
      href="/dashboard/pricing"
      onClick={() => trackUpgradeClick(source)}
      className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
    >
      {text ?? "Upgrade your subscription"}
    </Link>
  );
}

export default UpgradeText;
