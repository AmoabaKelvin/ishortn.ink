import { z } from "zod";

export type SystemStatus = "operational" | "degraded" | "outage";

// Maps every provider's vocabulary onto our three states. Maintenance counts as degraded so we
// never claim "operational" while something is intentionally down.
const STATE_MAP = {
  // Shared / OpenStatus
  operational: "operational",
  degraded: "degraded",
  degraded_performance: "degraded",
  partial_outage: "degraded",
  under_maintenance: "degraded",
  maintenance: "degraded",
  incident: "degraded",
  major_outage: "outage",
  // Better Stack aggregate_state
  downtime: "outage",
  // Atlassian Statuspage / Instatus indicator
  none: "operational",
  minor: "degraded",
  major: "outage",
  critical: "outage",
} satisfies Record<string, SystemStatus>;

const STATE_LOOKUP = new Map<string, SystemStatus>(Object.entries(STATE_MAP));

const providerState = z
  .string()
  .toLowerCase()
  .transform((state) => STATE_LOOKUP.get(state) ?? null);

/**
 * Parses a public status API response into our overall state. Supports OpenStatus
 * (`{ status }`), Statuspage-compatible APIs (`{ status: { indicator } }`) and Better Stack
 * (`{ data: { attributes: { aggregate_state } } }`). Unrecognised states parse to null so the
 * caller falls back to a neutral link.
 */
export const statusPayloadSchema = z.union([
  z.object({ status: providerState }).transform((payload) => payload.status),
  z
    .object({ status: z.object({ indicator: providerState }) })
    .transform((payload) => payload.status.indicator),
  z
    .object({ data: z.object({ attributes: z.object({ aggregate_state: providerState }) }) })
    .transform((payload) => payload.data.attributes.aggregate_state),
]);
