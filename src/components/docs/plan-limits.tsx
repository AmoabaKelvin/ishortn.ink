import {
  API_RATE_LIMITS,
  canRemoveBioBranding,
  canScheduleBioBlocks,
  canUseBioCustomDomain,
  canUseBioCustomThemes,
  canUseCampaignUtmDefaults,
  getPlanCaps,
} from "@/lib/billing/plans";

import type { Plan } from "@/lib/billing/plans";

const PLANS: { id: Plan; name: string }[] = [
  { id: "free", name: "Free" },
  { id: "pro", name: "Pro" },
  { id: "ultra", name: "Ultra" },
];

type Cap = keyof ReturnType<typeof getPlanCaps>;

function formatCap(plan: Plan, cap: Cap): string {
  const value = getPlanCaps(plan)[cap];
  if (value === undefined) return cap === "analyticsRangeLimitDays" ? "All time" : "Unlimited";
  if (value === 0) return "Not available";
  if (cap === "analyticsRangeLimitDays") return `Last ${value} days`;
  return value.toLocaleString("en-US");
}

/** One value from PLAN_CAPS, for use inside guide text. */
export function PlanValue({ plan, cap }: { plan: Plan; cap: Cap }) {
  return <>{formatCap(plan, cap)}</>;
}

const CAP_ROWS: { label: string; cap: Cap }[] = [
  { label: "New links per month", cap: "linksLimit" },
  { label: "Tracked clicks per month", cap: "eventsLimit" },
  { label: "Analytics date range", cap: "analyticsRangeLimitDays" },
  { label: "Custom domains", cap: "domainLimit" },
  { label: "Folders", cap: "folderLimit" },
  { label: "Targeting rules per link", cap: "geoRulesLimit" },
  { label: "Click milestones per link", cap: "milestonesPerLinkLimit" },
  { label: "Bio pages", cap: "bioPageLimit" },
  { label: "Link blocks per bio page", cap: "bioLinkBlocksPerPageLimit" },
  { label: "Active campaigns", cap: "campaignLimit" },
  { label: "Scheduled email reports", cap: "scheduledReportLimit" },
];

const FEATURE_ROWS: { label: string; allowed: (plan: Plan) => boolean }[] = [
  { label: "Remove iShortn branding from bio pages", allowed: canRemoveBioBranding },
  { label: "Custom bio page themes", allowed: canUseBioCustomThemes },
  { label: "Bio pages on a custom domain", allowed: canUseBioCustomDomain },
  { label: "Scheduled bio blocks", allowed: canScheduleBioBlocks },
  { label: "Campaign UTM defaults", allowed: canUseCampaignUtmDefaults },
];

/** The plan limits table, rendered straight from src/lib/billing/plans.ts. */
export function PlanLimits() {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table>
        <thead>
          <tr>
            <th>Limit</th>
            {PLANS.map((plan) => (
              <th key={plan.id}>{plan.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CAP_ROWS.map((row) => (
            <tr key={row.cap}>
              <td>{row.label}</td>
              {PLANS.map((plan) => (
                <td key={plan.id} className="whitespace-nowrap tabular-nums">
                  {formatCap(plan.id, row.cap)}
                </td>
              ))}
            </tr>
          ))}
          {FEATURE_ROWS.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              {PLANS.map((plan) => (
                <td key={plan.id} className="whitespace-nowrap">
                  {row.allowed(plan.id) ? "Yes" : "No"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The /api/v1 request limits, rendered from API_RATE_LIMITS in src/lib/billing/plans.ts. */
export function ApiRateLimits() {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table>
        <thead>
          <tr>
            <th>Window</th>
            {PLANS.map((plan) => (
              <th key={plan.id}>{plan.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(["perMinute", "perDay"] as const).map((window) => (
            <tr key={window}>
              <td>{window === "perMinute" ? "Requests per minute" : "Requests per day"}</td>
              {PLANS.map((plan) => (
                <td key={plan.id} className="whitespace-nowrap tabular-nums">
                  {API_RATE_LIMITS[plan.id][window].toLocaleString("en-US")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
