import type { TargetingRuleType } from "@/lib/constants/targeting";

export type TargetingKind = "device" | "location";

const KIND_BY_TYPE = {
  device: "device",
  os: "device",
  country: "location",
  continent: "location",
} satisfies Record<TargetingRuleType, TargetingKind>;

/** Collapses a link's rule types into what the links list shows: device and/or location rules. */
export function summarizeTargeting(types: readonly TargetingRuleType[]): {
  kinds: TargetingKind[];
  label: string;
} | null {
  const found = new Set(types.map((type) => KIND_BY_TYPE[type]));
  if (found.size === 0) return null;
  const kinds = (["device", "location"] as const).filter((kind) => found.has(kind));
  const label =
    kinds.length === 2
      ? "Device and location rules"
      : kinds[0] === "device"
        ? "Device rules"
        : "Location rules";
  return { kinds, label };
}
