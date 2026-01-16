export type GeoRuleMatchResult =
  | { matched: false }
  | { matched: true; action: "redirect"; destination: string; ruleId: number }
  | { matched: true; action: "block"; message: string | null; ruleId: number };
