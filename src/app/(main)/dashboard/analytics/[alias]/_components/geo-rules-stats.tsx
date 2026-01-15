"use client";

import { BarList } from "./bar-list";

type GeoRuleData = {
  id: number;
  action: "redirect" | "block";
};

type GeoRulesStatsProps = {
  totalVisits: { matchedGeoRuleId: number | null }[];
  geoRules: GeoRuleData[];
  totalClicks: number;
};

export function GeoRulesStats({
  totalVisits,
  geoRules,
  totalClicks,
}: GeoRulesStatsProps) {
  // Build a map of geo rule IDs to their actions
  const ruleActionMap = new Map<number, "redirect" | "block">();
  geoRules.forEach((rule) => {
    ruleActionMap.set(rule.id, rule.action);
  });

  // Calculate stats
  const stats = totalVisits.reduce(
    (acc, visit) => {
      if (visit.matchedGeoRuleId === null) {
        acc.defaultCount++;
      } else {
        const action = ruleActionMap.get(visit.matchedGeoRuleId);
        if (action === "redirect") {
          acc.redirectCount++;
        } else if (action === "block") {
          acc.blockCount++;
        }
      }
      return acc;
    },
    { defaultCount: 0, redirectCount: 0, blockCount: 0 }
  );

  // Convert to BarList format
  const records = [
    { name: "Default destination", clicks: stats.defaultCount },
    { name: "Redirected", clicks: stats.redirectCount },
    { name: "Blocked", clicks: stats.blockCount },
  ].filter((r) => r.clicks > 0);

  // Don't render if no data
  if (records.length === 0) {
    return null;
  }

  return (
    <BarList.BarListTitle
      title="Geotargeting"
      description="Traffic routing based on visitor location"
    >
      <BarList records={records} totalClicks={totalClicks} color="purple" />
    </BarList.BarListTitle>
  );
}
