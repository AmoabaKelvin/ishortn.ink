import { getCountryContinentCode } from "@/lib/countries";

import type { GeoRule as DbGeoRule } from "@/server/db/schema";
import type { GeoRuleMatchResult } from "@/lib/types/geo-rules";

/**
 * Check if a single rule matches the visitor's location
 */
function ruleMatches(
  rule: DbGeoRule,
  countryCode: string,
  continentCode: string | null
): boolean {
  const normalizedValues = rule.values.map((v) => v.toUpperCase());

  let matches = false;

  if (rule.type === "country") {
    matches = normalizedValues.includes(countryCode.toUpperCase());
  } else if (rule.type === "continent" && continentCode) {
    matches = normalizedValues.includes(continentCode.toUpperCase());
  }

  // Handle "not_in" condition - invert the match
  if (rule.condition === "not_in") {
    matches = !matches;
  }

  return matches;
}

/**
 * Sort rules by priority, with country rules taking precedence over continent rules
 * when priorities are equal
 */
function sortRules(rules: DbGeoRule[]): DbGeoRule[] {
  return [...rules].sort((a, b) => {
    // First sort by explicit priority (lower number = higher priority)
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }

    // If priorities are equal, country rules take precedence over continent rules
    if (a.type === "country" && b.type === "continent") return -1;
    if (a.type === "continent" && b.type === "country") return 1;

    return 0;
  });
}

/**
 * Match geo rules against a visitor's country code
 *
 * @param rules - Array of geo rules to match against
 * @param countryCode - ISO 3166-1 alpha-2 country code (e.g., "US", "DE")
 * @returns Match result indicating whether a rule matched and what action to take
 */
export function matchGeoRules(
  rules: DbGeoRule[] | null | undefined,
  countryCode: string | null | undefined
): GeoRuleMatchResult {
  // No rules or no country code means no match - fall through to default URL
  if (!rules || rules.length === 0 || !countryCode) {
    return { matched: false };
  }

  // Get the continent code for the country
  const continentCode = getCountryContinentCode(countryCode);

  // Sort rules by priority (country rules > continent rules when equal priority)
  const sortedRules = sortRules(rules);

  // Find the first matching rule
  for (const rule of sortedRules) {
    if (ruleMatches(rule, countryCode, continentCode)) {
      if (rule.action === "redirect") {
        return {
          matched: true,
          action: "redirect",
          destination: rule.destination!,
          ruleId: rule.id,
        };
      } else {
        return {
          matched: true,
          action: "block",
          message: rule.blockMessage,
          ruleId: rule.id,
        };
      }
    }
  }

  // No rule matched - fall through to default URL
  return { matched: false };
}
