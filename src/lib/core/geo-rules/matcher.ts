import { normalizeOsName } from "@/lib/constants/targeting";
import { getCountryContinentCode } from "@/lib/countries";
import { logger } from "@/lib/logger";

import type { GeoRuleMatchResult } from "@/lib/types/geo-rules";
import type { GeoRule as DbGeoRule } from "@/server/db/schema";

const log = logger.child({ component: "geo-rules" });

export type TargetingVisitor = {
  /** ISO 3166-1 alpha-2 country code, or null when geo lookup failed. */
  country: string | null;
  /** Device class from the UA parser ("mobile", "tablet", "Desktop"…), or null when not parsed. */
  device: string | null;
  /** OS name from the UA parser, or null when not parsed. */
  os: string | null;
};

/** True when any rule needs user-agent parsing to evaluate. */
export function rulesNeedDevice(rules: DbGeoRule[] | null | undefined): boolean {
  return !!rules?.some((rule) => rule.type === "device" || rule.type === "os");
}

function ruleMatches(
  rule: DbGeoRule,
  visitor: TargetingVisitor,
  continentCode: string | null,
): boolean {
  let matches = false;

  switch (rule.type) {
    case "country":
      if (!visitor.country) return false;
      matches = rule.values.some((v) => v.toUpperCase() === visitor.country?.toUpperCase());
      break;
    case "continent":
      if (!continentCode) return false;
      matches = rule.values.some((v) => v.toUpperCase() === continentCode.toUpperCase());
      break;
    case "device": {
      if (!visitor.device) return false;
      const device = visitor.device.toLowerCase();
      matches = rule.values.some((v) => v.toLowerCase() === device);
      break;
    }
    case "os": {
      const os = normalizeOsName(visitor.os);
      if (!os) return false;
      matches = rule.values.some((v) => v.toLowerCase() === os);
      break;
    }
  }

  return rule.condition === "not_in" ? !matches : matches;
}

/**
 * Sort rules by priority, with country rules taking precedence over continent rules
 * when priorities are equal
 */
function sortRules(rules: DbGeoRule[]): DbGeoRule[] {
  return [...rules].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }

    if (a.type === "country" && b.type === "continent") return -1;
    if (a.type === "continent" && b.type === "country") return 1;

    return 0;
  });
}

/**
 * Match targeting rules against a visitor. A rule whose dimension is unknown
 * for this visitor (no country, no parsed device) never matches, even under
 * "not_in" — we don't route on data we don't have.
 */
export function matchTargetingRules(
  rules: DbGeoRule[] | null | undefined,
  visitor: TargetingVisitor,
): GeoRuleMatchResult {
  if (!rules || rules.length === 0) {
    return { matched: false };
  }

  const continentCode = visitor.country ? getCountryContinentCode(visitor.country) : null;

  for (const rule of sortRules(rules)) {
    if (!ruleMatches(rule, visitor, continentCode)) continue;

    if (rule.action === "redirect") {
      if (!rule.destination) {
        log.warn(
          { ruleId: rule.id, linkId: rule.linkId },
          'rule action is "redirect" but destination is missing, skipping',
        );
        continue;
      }
      return {
        matched: true,
        action: "redirect",
        destination: rule.destination,
        ruleId: rule.id,
      };
    }

    return {
      matched: true,
      action: "block",
      message: rule.blockMessage,
      ruleId: rule.id,
    };
  }

  return { matched: false };
}
