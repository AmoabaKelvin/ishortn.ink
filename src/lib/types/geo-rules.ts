export type GeoCondition = "in" | "not_in";
export type GeoAction = "redirect" | "block";
export type GeoRuleType = "country" | "continent";

export interface GeoRule {
  id: number;
  linkId: number;
  type: GeoRuleType;
  condition: GeoCondition;
  values: string[]; // ISO country codes or continent codes (EU, AS, NA, SA, OC, AF)
  action: GeoAction;
  destination: string | null;
  blockMessage: string | null;
  priority: number;
  createdAt: Date | null;
}

export type GeoRuleMatchResult =
  | { matched: false }
  | { matched: true; action: "redirect"; destination: string; ruleId: number }
  | { matched: true; action: "block"; message: string | null; ruleId: number };
