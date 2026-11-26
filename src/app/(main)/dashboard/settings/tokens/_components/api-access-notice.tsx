import { IconAlertTriangle, IconKey, IconSparkles } from "@tabler/icons-react";

import { RecordPlanLimitView } from "@/components/record-plan-limit-view";
import { UpgradeCta } from "@/components/upgrade-cta";
import { formatSunsetDate } from "@/lib/billing/api-access";

import type { ApiAccess } from "@/lib/billing/api-access";

/** Shown instead of the create form to accounts without a paid plan. */
export function ApiProGate() {
  return (
    <div className="py-6 text-center">
      <RecordPlanLimitView limitKey="tokens_page_view" />
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 dark:bg-muted">
        <IconKey size={18} stroke={1.5} className="text-neutral-400 dark:text-muted-foreground" />
      </div>
      <p className="text-[14px] font-medium text-neutral-900 dark:text-foreground">
        API access is a Pro feature
      </p>
      <p className="mx-auto mt-1 max-w-sm text-[12px] text-neutral-400 dark:text-muted-foreground">
        Upgrade to Pro or Ultra to create API keys and manage your links and analytics from your own
        code.
      </p>
      <UpgradeCta
        requiredPlan="pro"
        source="api_access"
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-700"
      >
        <IconSparkles size={14} stroke={2} />
        Upgrade to Pro
      </UpgradeCta>
    </div>
  );
}

/** Explains when an existing key on an account without a paid plan stops (or stopped) working. */
export function ApiKeySunsetNotice({ access }: { access: ApiAccess }) {
  const message =
    access.status === "revoked"
      ? `API access is a Pro feature. This key stopped working on ${formatSunsetDate(access.sunsetAt)}.`
      : access.status === "sunsetting"
        ? `API access is a Pro feature. This key keeps working on Free limits until ${formatSunsetDate(access.sunsetAt)}.`
        : "API access is a Pro feature. Upgrade to keep using this key.";

  return (
    <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-700 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
      <IconAlertTriangle size={16} stroke={1.5} className="mt-0.5 shrink-0" />
      <p className="min-w-0">
        {message}{" "}
        <UpgradeCta
          requiredPlan="pro"
          source="api_access"
          className="font-medium underline underline-offset-2 hover:text-amber-800 dark:hover:text-amber-300"
        >
          Upgrade
        </UpgradeCta>
      </p>
    </div>
  );
}
