/** Actions the server rejects for plan reasons; logged to `PlanLimitHit`. */
export const PLAN_LIMIT_KEYS = [
  "monthly_links",
  "qr_codes",
  "bulk_qr_codes",
  "bio_pages",
  "bio_link_blocks",
  "campaigns",
  "custom_domains",
  "folders",
  "geo_rules",
  "milestones",
  "api_keys",
  "api_v1",
  "scheduled_reports",
] as const;

/** Gated screens shown to a free user; logged via `planLimits.recordView`. */
export const PLAN_LIMIT_VIEW_KEYS = [
  "analytics_range_view",
  "domains_page_view",
  "folders_page_view",
  "tokens_page_view",
] as const;

export type PlanLimitKey = (typeof PLAN_LIMIT_KEYS)[number];
export type PlanLimitViewKey = (typeof PLAN_LIMIT_VIEW_KEYS)[number];
