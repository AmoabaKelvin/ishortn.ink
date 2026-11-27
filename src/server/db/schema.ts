import { relations, sql } from "drizzle-orm";
import {
  boolean,
  char,
  date,
  datetime,
  index,
  int,
  json,
  longtext,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/mysql-core";

import type { StaticPayloadType, StaticQrPayload } from "@/lib/qr-generator/payload";
import type { QRCodeStyle } from "@/lib/qr-generator/types";

// ============================================================================
// TEAM TABLES
// ============================================================================

export const team = mysqlTable(
  "Team",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(), // subdomain: slug.ishortn.ink
    avatarUrl: text("avatarUrl"),
    defaultDomain: varchar("defaultDomain", { length: 255 }).default("ishortn.ink"),
    ownerId: varchar("ownerId", { length: 32 }).notNull(), // Ultra user who created the team
    createdAt: timestamp("createdAt").defaultNow(),
    updatedAt: timestamp("updatedAt").onUpdateNow(),
    deletedAt: timestamp("deletedAt"), // Soft delete timestamp for grace period cleanup
    // Grace period for a team whose owner is not on Ultra (see src/lib/billing/entitlements.ts).
    // Kept after it passes so the daily reconcile never grants a second one; cleared once the
    // owner is on Ultra again.
    ownerPlanGraceEndsAt: timestamp("ownerPlanGraceEndsAt"),
    ownerPlanGraceEmailStage: int("ownerPlanGraceEmailStage").default(0),
  },
  (table) => ({
    ownerIdIdx: index("ownerId_idx").on(table.ownerId),
    deletedAtIdx: index("deletedAt_idx").on(table.deletedAt), // Index for cleanup job queries
  }),
);

export const teamMember = mysqlTable(
  "TeamMember",
  {
    id: serial("id").primaryKey(),
    teamId: int("teamId").notNull(),
    userId: varchar("userId", { length: 32 }).notNull(),
    role: mysqlEnum("role", ["owner", "admin", "member"]).notNull(),
    createdAt: timestamp("createdAt").defaultNow(),
    updatedAt: timestamp("updatedAt").onUpdateNow(),
  },
  (table) => ({
    teamUserIdx: index("team_user_idx").on(table.teamId, table.userId),
    uniqueTeamUser: unique("unique_team_user").on(table.teamId, table.userId),
    userIdx: index("user_idx").on(table.userId),
  }),
);

export const teamInvite = mysqlTable(
  "TeamInvite",
  {
    id: serial("id").primaryKey(),
    teamId: int("teamId").notNull(),
    email: varchar("email", { length: 255 }),
    role: mysqlEnum("inviteRole", ["admin", "member"]).notNull().default("member"),
    token: varchar("token", { length: 64 }).notNull().unique(),
    invitedBy: varchar("invitedBy", { length: 32 }).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    acceptedAt: timestamp("acceptedAt"),
    declinedAt: timestamp("declinedAt"),
    // Revoked invites are kept until they expire so they still count toward the daily email limit.
    revokedAt: timestamp("revokedAt"),
    createdAt: timestamp("createdAt").defaultNow(),
  },
  (table) => ({
    teamIdx: index("team_idx").on(table.teamId),
  }),
);

// Reserved team slugs that cannot be used
export const RESERVED_TEAM_SLUGS = [
  "www",
  "api",
  "app",
  "admin",
  "dashboard",
  "mail",
  "smtp",
  "ftp",
  "ssh",
  "support",
  "help",
  "docs",
  "blog",
  "status",
  "cdn",
  "static",
  "assets",
  "img",
  "images",
  "js",
  "css",
  "fonts",
  "media",
  "download",
  "downloads",
  "login",
  "signin",
  "signup",
  "register",
  "auth",
  "oauth",
  "sso",
  "account",
  "accounts",
  "billing",
  "payment",
  "payments",
  "checkout",
  "subscribe",
  "subscription",
  "pricing",
  "terms",
  "privacy",
  "legal",
  "security",
  "abuse",
  "spam",
  "report",
  "null",
  "undefined",
  "test",
  "testing",
  "dev",
  "development",
  "staging",
  "prod",
  "production",
  "demo",
  "example",
  "sample",
];

export const user = mysqlTable(
  "User",
  {
    id: varchar("id", {
      length: 32,
    }).primaryKey(), // 32 chars is the length of clerk user id
    name: varchar("name", { length: 255 }),
    email: varchar("email", { length: 255 }).unique(),
    createdAt: timestamp("createdAt").defaultNow(),
    imageUrl: text("imageUrl"),
    qrCodeCount: int("qrCodeCount").default(0),
    monthlyLinkCount: int("monthlyLinkCount").default(0),
    lastLinkCountReset: timestamp("lastLinkCountReset").defaultNow(),
    // Lifetime count of CSV-imported links that used the custom-domain import allowance instead
    // of the monthly link limit (CUSTOM_DOMAIN_IMPORT_ALLOWANCE in routers/link/utils.ts).
    customDomainImportCount: int("customDomainImportCount").notNull().default(0),
    monthlyEventCount: int("monthlyEventCount").default(0),
    lastEventCountReset: timestamp("lastEventCountReset").defaultNow(),
    eventUsageAlertLevel: int("eventUsageAlertLevel").default(0),
    // Events dropped this month for being over the cap; reset with monthlyEventCount.
    droppedEventCount: int("droppedEventCount").default(0),
    eventTrackingPausedAt: timestamp("eventTrackingPausedAt"),
    lastViewedChangelogSlug: varchar("lastViewedChangelogSlug", { length: 100 }),
    // Milestone, usage-alert, domain-reminder, first-link nudge, upgrade nudge and weekly summary
    // emails. Account, billing and team emails ignore it.
    productEmailsEnabled: boolean("productEmailsEnabled").notNull().default(true),
    // Weekly click summary (see src/server/lib/weekly-summary.ts); sent only while
    // productEmailsEnabled is also on.
    weeklySummaryEnabled: boolean("weeklySummaryEnabled").notNull().default(true),
    // Account transfer deletion tracking
    deletedAt: timestamp("deletedAt"), // Soft delete timestamp for account transfer grace period
    // Platform admin
    isAdmin: boolean("isAdmin").default(false),
    // Ban status
    banned: boolean("banned").default(false),
    bannedAt: timestamp("bannedAt"),
    bannedReason: varchar("bannedReason", { length: 255 }),
    // Plan entitlement grace period (see src/lib/billing/entitlements.ts): the account keeps
    // `planGracePlan` until `planGraceEndsAt`. Kept after it passes so the daily reconcile never
    // grants a second one; cleared when the paid plan covers it again.
    planGracePlan: mysqlEnum("planGracePlan", ["free", "pro", "ultra"]),
    planGraceEndsAt: timestamp("planGraceEndsAt"),
    planGraceReason: mysqlEnum("planGraceReason", ["lapsed", "over_plan"]),
    planGraceEmailStage: int("planGraceEmailStage").default(0),
    // When the account's usage was last checked against its plan; null until the first check,
    // so accounts that predate enforcement get their grace period before any restriction applies.
    planCheckedAt: timestamp("planCheckedAt"),
    // API access sunset emails (see src/server/lib/api-access.ts): set once the
    // email went out, or once the account's keys were already past their cutoff.
    apiSunsetNoticeSentAt: timestamp("apiSunsetNoticeSentAt"),
    apiSunsetReminderSentAt: timestamp("apiSunsetReminderSentAt"),
    // First-link nudge (see src/server/lib/first-link-nudge.ts): set when the one reminder to
    // create a first link was sent, so an account never gets a second.
    firstLinkNudgeSentAt: timestamp("firstLinkNudgeSentAt"),
    // Paused-tracking promo notice (see src/server/lib/promo-paused-notice.ts): the promo code
    // whose one notice this account was sent, so it gets at most one per promo.
    promoNoticeSentFor: varchar("promoNoticeSentFor", { length: 32 }),
    // Upgrade nudge (see src/server/lib/upgrade-nudge.ts): when the one email offering Pro to an
    // active Free account went out, and the angle it led with, so an account never gets a second.
    upgradeNudgeSentAt: timestamp("upgradeNudgeSentAt"),
    upgradeNudgeReason: varchar("upgradeNudgeReason", { length: 32 }),
    // Restriction: can sign in and pay, but can't create or edit links, domains, bio pages or QR codes
    restrictedAt: timestamp("restrictedAt"),
    restrictedReason: varchar("restrictedReason", { length: 255 }),
  },
  (table) => ({
    deletedAtIdx: index("deletedAt_idx").on(table.deletedAt),
    planGraceEndsAtIdx: index("planGraceEndsAt_idx").on(table.planGraceEndsAt),
    createdAtIdx: index("createdAt_idx").on(table.createdAt),
    eventTrackingPausedAtIdx: index("eventTrackingPausedAt_idx").on(table.eventTrackingPausedAt),
  }),
);

export const subscription = mysqlTable(
  "Subscription",
  {
    id: serial("id").primaryKey(),
    userId: varchar("userId", {
      length: 32,
    })
      .notNull()
      .unique(),
    orderId: int("orderId").default(0),
    subscriptionId: int("subscriptionId").default(0),
    customerId: int("customerId").default(0),
    renewsAt: datetime("renewsAt"),
    createdAt: timestamp("createdAt"),
    endsAt: datetime("endsAt"),
    status: varchar("status", { length: 255 }).default(""),
    plan: mysqlEnum("plan", ["free", "pro", "ultra"]).default("free"),
    billingInterval: mysqlEnum("billingInterval", ["monthly", "annual"]).default("monthly"),
    variantId: int("variantId").default(0),
    productId: int("productId").default(0),
    // Provider's own updated_at for the last event applied. Webhook deliveries
    // can arrive out of order or be replayed, so events older than this are
    // dropped instead of overwriting current state.
    providerUpdatedAt: datetime("providerUpdatedAt"),
    // When a paused subscription starts billing again (the provider's pause.resumes_at); null
    // when not paused.
    pausedUntil: datetime("pausedUntil"),
    // When an in-app Paddle plan change removed the subscription's first-year promo discount. The
    // row is reused across subscriptions, so it only counts if later than the promo's checkout.
    promoDiscountEndedAt: datetime("promoDiscountEndedAt"),

    // details about the payment to show in the dashboard
    cardBrand: varchar("cardBrand", { length: 255 }).default(""),
    cardLastFour: varchar("cardLastFour", { length: 4 }).default(""),

    // Which provider manages this subscription. Rows created before a second provider existed
    // read as Lemon Squeezy through the default, with no data rewrite.
    billingProvider: varchar("billingProvider", { length: 16 }).notNull().default("lemonsqueezy"),
    // Paddle ids are strings (`sub_…`, `ctm_…`, `pri_…`), so they can't use the int
    // `subscriptionId` / `customerId` / `variantId` columns above, which stay as they are for
    // Lemon Squeezy rows. Null on Lemon Squeezy rows.
    providerSubscriptionId: varchar("providerSubscriptionId", { length: 64 }),
    providerCustomerId: varchar("providerCustomerId", { length: 64 }),
    providerPriceId: varchar("providerPriceId", { length: 64 }),
  },
  (table) => ({
    userIdx: index("userId_idx").on(table.userId),
    providerSubscriptionIdIdx: index("subscription_providerSubscriptionId_idx").on(
      table.providerSubscriptionId,
    ),
    providerCustomerIdIdx: index("subscription_providerCustomerId_idx").on(
      table.providerCustomerId,
    ),
  }),
);

// First-touch campaign attribution for a signup, written once by
// `attribution.record` from the `ish_ft` cookie.
export const userAttribution = mysqlTable(
  "UserAttribution",
  {
    userId: varchar("userId", { length: 32 }).primaryKey(),
    utmSource: varchar("utmSource", { length: 255 }),
    utmMedium: varchar("utmMedium", { length: 255 }),
    utmCampaign: varchar("utmCampaign", { length: 255 }),
    utmTerm: varchar("utmTerm", { length: 255 }),
    utmContent: varchar("utmContent", { length: 255 }),
    clickId: varchar("clickId", { length: 255 }),
    // gclid, gbraid, wbraid, msclkid, rdt_cid, fbclid or li_fat_id
    clickIdType: varchar("clickIdType", { length: 16 }),
    landingPath: varchar("landingPath", { length: 255 }),
    referrerHost: varchar("referrerHost", { length: 255 }),
    firstSeenAt: timestamp("firstSeenAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    utmCampaignIdx: index("utmCampaign_idx").on(table.utmCampaign),
  }),
);

export const link = mysqlTable(
  "Link",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }),
    url: text("url"),
    alias: varchar("alias", {
      length: 20,
    }),
    domain: varchar("domain", { length: 255 }).notNull().default("ishortn.ink"),
    createdAt: timestamp("createdAt").defaultNow(),
    disableLinkAfterClicks: int("disableLinkAfterClicks"),
    // Visits counted toward disableLinkAfterClicks, including ones the monthly event cap kept out
    // of analytics. Null until the first counted visit, which starts it from the recorded total.
    clickLimitCount: int("clickLimitCount"),
    disableLinkAfterDate: datetime("disableLinkAfterDate"),
    activateAt: datetime("activateAt"), // link is not reachable before this instant
    disabled: boolean("disabled").default(false),
    publicStats: boolean("publicStats").default(false),
    userId: varchar("userId", {
      length: 32,
    }).notNull(),
    teamId: int("teamId"), // null = personal workspace, non-null = team workspace
    createdByUserId: varchar("createdByUserId", { length: 32 }), // tracks original creator (immutable)
    passwordHash: text("passwordHash"),
    note: varchar("note", { length: 255 }),
    metadata: json("metadata"),
    utmParams: json("utmParams").$type<{
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
      utm_term?: string;
      utm_content?: string;
    }>(),
    tags: json("tags").$type<string[]>().default([]),
    archived: boolean("archived").default(false),
    folderId: int("folderId"),
    campaignId: int("campaignId"),
    cloaking: boolean("cloaking").default(false),
    verifiedClicksEnabled: boolean("verifiedClicksEnabled").default(false),
    isQrCode: boolean("isQrCode").default(false),
    isBioLink: boolean("isBioLink").default(false), // hidden link backing a bio-page link block
    // Admin moderation
    blocked: boolean("blocked").default(false),
    blockedAt: timestamp("blockedAt"),
    blockedReason: varchar("blockedReason", { length: 255 }),
    // Read-only analytics page at /stats/<token>: shared while the token is set. Separate from
    // the retired publicStats flag so legacy opt-ins never become public without a fresh one.
    statsShareToken: varchar("statsShareToken", { length: 64 }),
    statsSharedAt: timestamp("statsSharedAt"),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    teamIdIdx: index("teamId_idx").on(table.teamId),
    statsShareTokenIdx: unique("statsShareToken_idx").on(table.statsShareToken),
    aliasDomainIdx: index("aliasDomain_idx").on(table.alias, table.domain),
    uniqueAliasDomainIdx: unique("unique_alias_domain").on(table.alias, table.domain), // we have to have unique entries for alias and domain. so that we can't have two links with the same alias and domain
    folderIdIdx: index("folderId_idx").on(table.folderId),
    campaignIdIdx: index("campaignId_idx").on(table.campaignId),
    createdAtIdx: index("createdAt_idx").on(table.createdAt),
    blockedAtIdx: index("blocked_blockedAt_idx").on(table.blocked, table.blockedAt),
    domainIdx: index("domain_idx").on(table.domain),
    listingIdx: index("listing_idx").on(table.userId, table.teamId, table.isQrCode, table.archived),
    // GET /api/v1/links pages newest first; lets each page read only its own rows.
    newestIdx: index("userId_teamId_createdAt_idx").on(
      table.userId,
      table.teamId,
      table.createdAt,
      table.id,
    ),
  }),
);

// Aliases on platform domains that may never be claimed again once their link is
// gone, so old printed codes and shared URLs can't start pointing somewhere new.
// Custom-domain aliases are not recorded: only the domain's owner can use them.
export const reservedAlias = mysqlTable(
  "ReservedAlias",
  {
    id: serial("id").primaryKey(),
    domain: varchar("domain", { length: 255 }).notNull(),
    alias: varchar("alias", { length: 20 }).notNull(), // normalizeAlias()d
    reason: mysqlEnum("reason", ["deleted", "purged", "blocked"]).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    domainAliasIdx: unique("reservedAlias_domain_alias").on(table.domain, table.alias),
  }),
);

// Addresses a link answered on before it moved to another domain. The redirect lookup
// matches them alongside Link.domain/alias, so old printed and shared URLs keep working,
// and the address stays reserved (for every account) after the link is deleted.
export const linkPreviousAddress = mysqlTable(
  "LinkPreviousAddress",
  {
    id: serial("id").primaryKey(),
    linkId: int("linkId").notNull(),
    domain: varchar("domain", { length: 255 }).notNull(), // lowercase
    alias: varchar("alias", { length: 20 }).notNull(), // normalizeAlias()d
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    domainAliasIdx: unique("linkPreviousAddress_domain_alias").on(table.domain, table.alias),
    linkIdIdx: index("linkPreviousAddress_linkId_idx").on(table.linkId),
  }),
);

// Targeting rules for links: route or block by visitor location or device
export const geoRule = mysqlTable(
  "GeoRule",
  {
    id: serial("id").primaryKey(),
    linkId: int("linkId").notNull(),
    type: mysqlEnum("type", ["country", "continent", "device", "os"]).notNull(),
    condition: mysqlEnum("condition", ["in", "not_in"]).notNull().default("in"),
    values: json("values").$type<string[]>().notNull(), // ISO country codes, continent codes, device types, or OS keys
    action: mysqlEnum("action", ["redirect", "block"]).notNull(),
    destination: varchar("destination", { length: 2048 }), // URL for redirect action
    blockMessage: varchar("blockMessage", { length: 500 }), // Custom message for block action
    priority: int("priority").notNull().default(0), // Lower = higher priority
    createdAt: timestamp("createdAt").defaultNow(),
  },
  (table) => ({
    linkIdIdx: index("linkId_idx").on(table.linkId),
    priorityIdx: index("priority_idx").on(table.linkId, table.priority),
  }),
);

export const linkVisit = mysqlTable(
  "LinkVisit",
  {
    id: serial("id").primaryKey(),
    linkId: int("linkId").notNull(),
    device: varchar("device", { length: 255 }),
    browser: varchar("browser", { length: 255 }),
    os: varchar("os", { length: 255 }),
    model: varchar("model", { length: 255 }).default(""),
    referer: varchar("referer", { length: 255 }),
    country: varchar("country", { length: 255 }),
    city: varchar("city", { length: 255 }),
    continent: varchar("continent", { length: 255 }).default("N/A"),
    matchedGeoRuleId: int("matchedGeoRuleId"), // Reference to the geo rule that matched (for analytics)
    visitId: char("visitId", { length: 36 }), // queue message id; dedupes redelivered clicks and keys the verified-click beacon
    verifiedAt: timestamp("verifiedAt"), // set when the destination-page beacon POSTs back with a valid token
    createdAt: timestamp("createdAt").defaultNow(),
  },
  (table) => ({
    linkIdIdx: index("linkId_idx").on(table.linkId),
    geoRuleIdIdx: index("geoRuleId_idx").on(table.matchedGeoRuleId),
    linkCreatedAtIdx: index("linkId_createdAt_idx").on(table.linkId, table.createdAt),
    createdAtIdx: index("createdAt_idx").on(table.createdAt),
    visitIdIdx: unique("visitId_idx").on(table.visitId),
  }),
);

export const uniqueLinkVisit = mysqlTable(
  "UniqueLinkVisit",
  {
    id: serial("id").primaryKey(),
    linkId: int("linkId").notNull(),
    ipHash: char("ipHash", { length: 64 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow(),
  },
  (table) => ({
    linkIdIdx: index("linkId_idx").on(table.linkId),
    ipHashIdx: index("ipHash_idx").on(table.ipHash),
    uniqueVisitIdx: unique("unique_visit_idx").on(table.linkId, table.ipHash),
    linkCreatedAtIdx: index("linkId_createdAt_idx").on(table.linkId, table.createdAt),
  }),
);

// Daily rollup of link visit analytics.
// Created by the analytics cleanup job before deleting raw LinkVisit/UniqueLinkVisit
// records, preserving historical click trends beyond the retention window.
export const linkVisitDailySummary = mysqlTable(
  "LinkVisitDailySummary",
  {
    id: serial("id").primaryKey(),
    linkId: int("linkId").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    clicks: int("clicks").notNull().default(0),
    uniqueClicks: int("uniqueClicks").notNull().default(0),
  },
  (table) => ({
    linkDateUnique: unique("link_date_unique").on(table.linkId, table.date),
  }),
);

export const linkVisitDailySummaryRelations = relations(linkVisitDailySummary, ({ one }) => ({
  link: one(link, {
    fields: [linkVisitDailySummary.linkId],
    references: [link.id],
  }),
}));

// One row per account per summarised week (weekStart is the Monday, UTC). Inserted before the
// weekly summary email goes out, so a retried or overlapping run never sends the week twice;
// sentAt is set once Resend accepts it, and the row is removed if the send is rejected.
export const weeklySummaryEmail = mysqlTable(
  "WeeklySummaryEmail",
  {
    id: serial("id").primaryKey(),
    userId: varchar("userId", { length: 32 }).notNull(),
    weekStart: date("weekStart", { mode: "string" }).notNull(),
    clicks: int("clicks").notNull(),
    sentAt: timestamp("sentAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    weekUserUnique: unique("weeklySummaryEmail_week_user").on(table.weekStart, table.userId),
  }),
);

export const linkMilestone = mysqlTable(
  "LinkMilestone",
  {
    id: serial("id").primaryKey(),
    linkId: int("linkId").notNull(),
    userId: varchar("userId", { length: 32 }).notNull(),
    threshold: int("threshold").notNull(),
    notifiedAt: timestamp("notifiedAt"),
    createdAt: timestamp("createdAt").defaultNow(),
  },
  (table) => ({
    linkIdIdx: index("linkId_idx").on(table.linkId),
    linkThresholdUnique: unique("link_threshold_unique").on(table.linkId, table.threshold),
  }),
);

export const linkMilestoneRelations = relations(linkMilestone, ({ one }) => ({
  link: one(link, {
    fields: [linkMilestone.linkId],
    references: [link.id],
  }),
}));

export const token = mysqlTable(
  "Token",
  {
    id: serial("id").primaryKey(),
    token: varchar("token", { length: 255 }),
    name: varchar("name", { length: 64 }),
    // First characters of the plaintext key, shown in settings so keys can be told apart.
    prefix: varchar("prefix", { length: 8 }),
    // "api" keys work on /api/v1 only; "extension" tokens (browser extension connect flow) work
    // on /api/extension only, so they can't be used to reach the paid-plan v1 API.
    kind: varchar("kind", { length: 16 }).$type<"api" | "extension">().notNull().default("api"),
    // Set from the connect request for extension tokens, e.g. "Chrome on macOS".
    label: varchar("label", { length: 64 }),
    lastUsedAt: timestamp("lastUsedAt"),
    createdAt: timestamp("createdAt").defaultNow(),
    userId: varchar("userId", { length: 32 }).notNull(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    tokenIdx: index("token_idx").on(table.token),
  }),
);

export const qrcode = mysqlTable(
  "QrCode",
  {
    id: serial("id").primaryKey(),
    qrCode: longtext("qrCode"), // the qr code image: will be stored as a base64 string
    title: varchar("title", { length: 255 }).default(""),
    createdAt: timestamp("createdAt").defaultNow(),
    userId: varchar("userId", { length: 32 }).notNull(),
    teamId: int("teamId"), // null = personal workspace, non-null = team workspace
    linkId: int("linkId").default(0), // the link that the qrcode is associated with (if any)

    // we need to store the presets for the qrcode in order to view the previous styles used when modifying the qrcode
    // the presets will be stored as a JSON string
    contentType: mysqlEnum("contentType", ["link", "text"]).notNull(),
    content: text("content").notNull(),

    // Pattern style
    patternStyle: mysqlEnum("patternStyle", [
      "square",
      "diamond",
      "star",
      "fluid",
      "rounded",
      "tile",
      "stripe",
      "fluid-line",
      "stripe-column",
    ]).notNull(),

    // Corner style
    cornerStyle: mysqlEnum("cornerStyle", [
      "circle",
      "circle-diamond",
      "square",
      "square-diamond",
      "rounded-circle",
      "rounded",
      "circle-star",
    ]).notNull(),

    // Color
    color: varchar("color", { length: 7 }).notNull(),

    // Generator options used for the SVG download; null for codes saved before SVG export.
    style: json("style").$type<QRCodeStyle>(),

    // Static codes (contentType "text") built from a form: which form, and its fields so the
    // editor can re-open them. Null for links, plain text and codes made before these types.
    payloadType: varchar("payloadType", { length: 16 }).$type<StaticPayloadType>(),
    payloadFields: json("payloadFields").$type<StaticQrPayload>(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    teamIdIdx: index("teamId_idx").on(table.teamId),
    linkIdIdx: index("linkId_idx").on(table.linkId),
  }),
);

// QR Code Presets for saving reusable QR code styles
export const qrPreset = mysqlTable(
  "QrPreset",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    userId: varchar("userId", { length: 32 }).notNull(),
    teamId: int("teamId"), // null = personal workspace, non-null = team workspace

    // Style settings
    pixelStyle: varchar("pixelStyle", { length: 50 }).notNull().default("rounded"),
    markerFrame: varchar("markerShape", { length: 50 }).notNull().default("square"),
    markerCenter: varchar("markerInnerShape", { length: 50 }).notNull().default("auto"),
    darkColor: varchar("darkColor", { length: 9 }).notNull().default("#000000"),
    lightColor: varchar("lightColor", { length: 9 }).notNull().default("#ffffff"),

    // Effect settings
    effect: varchar("effect", { length: 50 }).notNull().default("none"),
    effectRadius: int("effectRadius").notNull().default(12),

    // Margin noise settings
    marginNoise: boolean("marginNoise").notNull().default(false),
    marginNoiseRate: varchar("marginNoiseRate", { length: 10 }).notNull().default("0.5"),

    // Logo settings
    logoImage: longtext("logoImage"), // Base64 encoded image
    logoSize: int("logoSize").notNull().default(25),
    logoMargin: int("logoMargin").notNull().default(4),
    logoBorderRadius: int("logoBorderRadius").notNull().default(8),

    createdAt: timestamp("createdAt").defaultNow(),
    updatedAt: timestamp("updatedAt").onUpdateNow(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    teamIdIdx: index("teamId_idx").on(table.teamId),
  }),
);

export const siteSettings = mysqlTable(
  "SiteSettings",
  {
    id: serial("id").primaryKey(),
    userId: varchar("userId", { length: 32 }).notNull(),
    teamId: int("teamId"), // null = personal workspace, non-null = team workspace
    defaultDomain: varchar("defaultDomain", { length: 255 }).default("ishortn.ink"),
    createdAt: timestamp("createdAt").defaultNow(),
    updatedAt: timestamp("updatedAt").onUpdateNow(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    teamIdIdx: index("teamId_idx").on(table.teamId),
  }),
);

// When API keys on accounts without Pro/Ultra stop working (see
// src/server/lib/api-access.ts). A single row (id 1), inserted by the first
// api-access-sunset cron run after deploy and never moved afterwards.
export const apiAccessSunset = mysqlTable("ApiAccessSunset", {
  id: int("id").primaryKey(),
  sunsetAt: timestamp("sunsetAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// One row per failed link creation, read by the link-creation-health cron to
// alert on failure spikes (src/server/lib/link-creation). Holds no URL or user
// details; rows older than the retention window are pruned by that cron.
export const linkCreationFailure = mysqlTable(
  "LinkCreationFailure",
  {
    id: serial("id").primaryKey(),
    source: mysqlEnum("source", ["dashboard", "bulk", "api"]).notNull(),
    step: mysqlEnum("step", ["validation", "safety", "metadata", "db"]).notNull(),
    code: varchar("code", { length: 64 }).notNull(),
    serverError: boolean("serverError").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    createdAtIdx: index("createdAt_idx").on(table.createdAt),
  }),
);

// Tag model for storing unique tags
// Uniqueness strategy:
// - Team workspaces: unique(name, teamId) enforced at DB level
// - Personal workspaces: uniqueness enforced at application layer (tag.service.ts)
//   because MySQL treats NULL teamId values as distinct in unique constraints
export const tag = mysqlTable(
  "Tag",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 50 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow(),
    userId: varchar("userId", { length: 32 }).notNull(),
    teamId: int("teamId"), // null = personal workspace, non-null = team workspace
  },
  (table) => ({
    nameIdx: index("name_idx").on(table.name),
    userIdIdx: index("userId_idx").on(table.userId),
    teamIdIdx: index("teamId_idx").on(table.teamId),
    // Prevents duplicate tag names within a team (where teamId is NOT NULL)
    // Personal workspace tags (teamId=NULL) are deduplicated at application layer
    uniqueTagPerTeam: unique("unique_tag_team").on(table.name, table.teamId),
  }),
);

// Folder model for organizing links
export const folder = mysqlTable(
  "Folder",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    userId: varchar("userId", { length: 32 }).notNull(),
    teamId: int("teamId"), // null = personal workspace, non-null = team workspace
    isRestricted: boolean("isRestricted").default(false).notNull(), // true = restricted access (admins + permitted users only)
    createdAt: timestamp("createdAt").defaultNow(),
    updatedAt: timestamp("updatedAt").onUpdateNow(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    teamIdIdx: index("teamId_idx").on(table.teamId),
  }),
);

// FolderPermission join table for folder-level access control in teams
// Permission semantics:
// - folder.isRestricted=false: visible to ALL team members (default behavior)
// - folder.isRestricted=true with permission records: RESTRICTED to those specific users + admins/owners
// - folder.isRestricted=true with no permission records: only admins/owners can access
// - Owners and admins ALWAYS bypass permission checks (handled in application layer)
export const folderPermission = mysqlTable(
  "FolderPermission",
  {
    folderId: int("folderId").notNull(),
    userId: varchar("userId", { length: 32 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.folderId, table.userId] }),
    userIdIdx: index("userId_idx").on(table.userId),
  }),
);

// LinkTag join table for many-to-many relationship
export const linkTag = mysqlTable(
  "LinkTag",
  {
    linkId: int("linkId").notNull(),
    tagId: int("tagId").notNull(),
    createdAt: timestamp("createdAt").defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.linkId, table.tagId] }),
    tagIdIdx: index("tagId_idx").on(table.tagId),
  }),
);

// ============================================================================
// ADMIN / MODERATION TABLES
// ============================================================================

export const blockedDomain = mysqlTable("BlockedDomain", {
  id: serial("id").primaryKey(),
  domain: varchar("domain", { length: 255 }).notNull().unique(),
  reason: varchar("reason", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow(),
  createdByUserId: varchar("createdByUserId", { length: 32 }),
});

// Addresses Resend reported as hard-bounced or complained (src/app/api/webhooks/resend).
// Non-essential email skips active rows; a later delivery clears a bounce by setting clearedAt.
export const emailSuppression = mysqlTable(
  "EmailSuppression",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    type: mysqlEnum("suppressionType", ["bounced", "complained"]).notNull(),
    // The account with this address when the event arrived, if any.
    userId: varchar("userId", { length: 32 }),
    detail: varchar("detail", { length: 255 }),
    lastEventAt: timestamp("lastEventAt").notNull(),
    clearedAt: timestamp("clearedAt"),
    createdAt: timestamp("createdAt").defaultNow(),
  },
  (table) => ({
    emailTypeIdx: unique("emailSuppression_email_type_idx").on(table.email, table.type),
    lastEventAtIdx: index("emailSuppression_lastEventAt_idx").on(table.lastEventAt),
  }),
);

export const flaggedLink = mysqlTable(
  "FlaggedLink",
  {
    id: serial("id").primaryKey(),
    linkId: int("linkId").notNull(),
    reason: varchar("reason", { length: 255 }),
    reporterEmail: varchar("reporterEmail", { length: 320 }),
    details: text("details"),
    status: mysqlEnum("flagStatus", ["pending", "blocked", "dismissed"])
      .notNull()
      .default("pending"),
    flaggedAt: timestamp("flaggedAt").defaultNow(),
    resolvedAt: timestamp("resolvedAt"),
    resolvedByUserId: varchar("resolvedByUserId", { length: 32 }),
  },
  (table) => ({
    linkIdIdx: index("linkId_idx").on(table.linkId),
    statusIdx: index("status_idx").on(table.status),
  }),
);

// Links whose destination the phishing re-scan fetches again after creation: pages the
// creation-time check couldn't judge (a bot-challenge or error page, or a failed fetch), and new
// links from new free accounts. Also the re-scan's progress, so no check runs twice.
export const linkSafetyRecheck = mysqlTable(
  "LinkSafetyRecheck",
  {
    id: serial("id").primaryKey(),
    linkId: int("linkId").notNull(),
    // "unverified-challenge", "scrape-failed" or "new-account"; varchar so new reasons need no
    // migration.
    reason: varchar("reason", { length: 32 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    // Scheduled content checks done so far (see CONTENT_CHECK_DELAYS_MS in the re-scan).
    checksDone: int("checksDone").default(0).notNull(),
    // Set when a run takes the row, so an overlapping run leaves it alone.
    lastCheckedAt: timestamp("lastCheckedAt"),
    // Outcome of the last check: "clean", "unverified", "phishing", "error" or "skipped"; while a
    // run holds the row, that run's "claim:…" token.
    result: varchar("result", { length: 16 }),
  },
  (table) => ({
    linkIdIdx: index("linkId_idx").on(table.linkId),
    createdAtIdx: index("createdAt_idx").on(table.createdAt),
  }),
);

// Define relations
export const linkRelations = relations(link, ({ one, many }) => ({
  user: one(user, {
    fields: [link.userId],
    references: [user.id],
  }),
  team: one(team, {
    fields: [link.teamId],
    references: [team.id],
  }),
  linkVisits: many(linkVisit),
  uniqueLinkVisits: many(uniqueLinkVisit),
  linkTags: many(linkTag),
  folder: one(folder, {
    fields: [link.folderId],
    references: [folder.id],
  }),
  campaign: one(campaign, {
    fields: [link.campaignId],
    references: [campaign.id],
  }),
  geoRules: many(geoRule),
  flaggedLinks: many(flaggedLink),
  milestones: many(linkMilestone),
}));

export const geoRuleRelations = relations(geoRule, ({ one }) => ({
  link: one(link, {
    fields: [geoRule.linkId],
    references: [link.id],
  }),
}));

export const flaggedLinkRelations = relations(flaggedLink, ({ one }) => ({
  link: one(link, {
    fields: [flaggedLink.linkId],
    references: [link.id],
  }),
  resolvedBy: one(user, {
    fields: [flaggedLink.resolvedByUserId],
    references: [user.id],
  }),
}));

export const blockedDomainRelations = relations(blockedDomain, ({ one }) => ({
  createdBy: one(user, {
    fields: [blockedDomain.createdByUserId],
    references: [user.id],
  }),
}));

export const customDomain = mysqlTable(
  "CustomDomain",
  {
    id: serial("id").primaryKey(),
    domain: varchar("domain", { length: 255 }),
    userId: varchar("userId", { length: 32 }).notNull(),
    teamId: int("teamId"), // null = personal workspace, non-null = team workspace
    createdAt: timestamp("createdAt").defaultNow(),
    status: mysqlEnum("status", ["pending", "active", "invalid"]).default("pending"),
    verificationDetails: json("verificationDetails"),
    lastReminderSentAt: timestamp("lastReminderSentAt"),
    // Set when an account restriction released this apex's www fallback hostname,
    // so lifting the restriction re-adds it (and only then)
    wwwHostnameReleased: boolean("wwwHostnameReleased").default(false),
    // Admin review for domains added by new accounts (see domains/rdap.ts). null when the
    // domain was never held; a "held" domain stays out of "active" until approved.
    reviewStatus: mysqlEnum("reviewStatus", ["held", "approved", "rejected"]),
    reviewReason: varchar("reviewReason", { length: 255 }),
    reviewedAt: timestamp("reviewedAt"),
    // RDAP data for the registrable domain, captured when the domain was added
    registrableDomainRegisteredAt: timestamp("registrableDomainRegisteredAt"),
    registrar: varchar("registrar", { length: 255 }),
    rdapLookupFailed: boolean("rdapLookupFailed").default(false),
    // Generated column to handle NULL teamId in unique constraint
    // MySQL treats NULLs as distinct, so we coalesce to 0 for personal workspaces
    teamIdForUnique: int("teamIdForUnique").generatedAlwaysAs(sql`COALESCE(\`teamId\`, 0)`, {
      mode: "stored",
    }),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    teamIdIdx: index("teamId_idx").on(table.teamId),
    statusCreatedAtIdx: index("status_createdAt_idx").on(table.status, table.createdAt),
    reviewStatusIdx: index("reviewStatus_idx").on(table.reviewStatus),
    // Allow the same domain in different workspaces, but not in the same workspace twice
    // Uses teamIdForUnique to properly handle NULL teamId values
    domainWorkspaceUnique: unique("domain_workspace_unique").on(
      table.domain,
      table.userId,
      table.teamIdForUnique,
    ),
  }),
);

export const userRelations = relations(user, ({ many, one }) => ({
  links: many(link),
  tokens: one(token, {
    fields: [user.id],
    references: [token.userId],
  }),
  qrcodes: many(qrcode),
  subscriptions: one(subscription, {
    fields: [user.id],
    references: [subscription.userId],
  }),
  customDomains: many(customDomain),
  siteSettings: one(siteSettings),
  tags: many(tag),
  folders: many(folder),
  folderPermissions: many(folderPermission),
  utmTemplates: many(utmTemplate),
  teamMemberships: many(teamMember),
  ownedTeams: many(team),
  outgoingTransfers: many(accountTransfer, { relationName: "outgoingTransfers" }),
  incomingTransfers: many(accountTransfer, { relationName: "incomingTransfers" }),
  feedbacks: many(feedback),
  audienceFeedback: one(audienceFeedback),
}));

export const linkVisitRelations = relations(linkVisit, ({ one }) => ({
  link: one(link, {
    fields: [linkVisit.linkId],
    references: [link.id],
  }),
  matchedGeoRule: one(geoRule, {
    fields: [linkVisit.matchedGeoRuleId],
    references: [geoRule.id],
  }),
}));

export const tokenRelations = relations(token, ({ one }) => ({
  user: one(user, {
    fields: [token.userId],
    references: [user.id],
  }),
}));

export const subscriptionRelations = relations(subscription, ({ one }) => ({
  user: one(user, {
    fields: [subscription.userId],
    references: [user.id],
  }),
}));

export const qrcodeRelations = relations(qrcode, ({ one }) => ({
  user: one(user, {
    fields: [qrcode.userId],
    references: [user.id],
  }),
  team: one(team, {
    fields: [qrcode.teamId],
    references: [team.id],
  }),
  link: one(link, {
    fields: [qrcode.linkId],
    references: [link.id],
  }),
}));

export const customDomainRelations = relations(customDomain, ({ one }) => ({
  user: one(user, {
    fields: [customDomain.userId],
    references: [user.id],
  }),
  team: one(team, {
    fields: [customDomain.teamId],
    references: [team.id],
  }),
}));

export const uniqueLinkVisitRelations = relations(uniqueLinkVisit, ({ one }) => ({
  link: one(link, {
    fields: [uniqueLinkVisit.linkId],
    references: [link.id],
  }),
}));

export const siteSettingsRelations = relations(siteSettings, ({ one }) => ({
  user: one(user, {
    fields: [siteSettings.userId],
    references: [user.id],
  }),
  team: one(team, {
    fields: [siteSettings.teamId],
    references: [team.id],
  }),
}));

// Define relations for Tag
export const tagRelations = relations(tag, ({ many, one }) => ({
  user: one(user, {
    fields: [tag.userId],
    references: [user.id],
  }),
  team: one(team, {
    fields: [tag.teamId],
    references: [team.id],
  }),
  linkTags: many(linkTag),
}));

// Define relations for LinkTag
export const linkTagRelations = relations(linkTag, ({ one }) => ({
  link: one(link, {
    fields: [linkTag.linkId],
    references: [link.id],
  }),
  tag: one(tag, {
    fields: [linkTag.tagId],
    references: [tag.id],
  }),
}));

// Define relations for Folder
export const folderRelations = relations(folder, ({ one, many }) => ({
  user: one(user, {
    fields: [folder.userId],
    references: [user.id],
  }),
  team: one(team, {
    fields: [folder.teamId],
    references: [team.id],
  }),
  links: many(link),
  permissions: many(folderPermission),
}));

// Define relations for FolderPermission
export const folderPermissionRelations = relations(folderPermission, ({ one }) => ({
  folder: one(folder, {
    fields: [folderPermission.folderId],
    references: [folder.id],
  }),
  user: one(user, {
    fields: [folderPermission.userId],
    references: [user.id],
  }),
}));

export type CustomDomain = typeof customDomain.$inferSelect;
export type NewCustomDomain = typeof customDomain.$inferInsert;

export type Link = typeof link.$inferSelect;
export type NewLink = typeof link.$inferInsert;

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

export type LinkVisit = typeof linkVisit.$inferSelect;
export type NewLinkVisit = typeof linkVisit.$inferInsert;
export type UniqueLinkVisit = typeof uniqueLinkVisit.$inferSelect;
export type NewUniqueLinkVisit = typeof uniqueLinkVisit.$inferInsert;

export type Token = typeof token.$inferSelect;
export type NewToken = typeof token.$inferInsert;

export type Subscription = typeof subscription.$inferSelect;
export type NewSubscription = typeof subscription.$inferInsert;

export type QrCode = typeof qrcode.$inferSelect;
export type NewQrCode = typeof qrcode.$inferInsert;

export type Tag = typeof tag.$inferSelect;
export type NewTag = typeof tag.$inferInsert;

export type LinkTag = typeof linkTag.$inferSelect;
export type NewLinkTag = typeof linkTag.$inferInsert;

export type Folder = typeof folder.$inferSelect;
export type NewFolder = typeof folder.$inferInsert;

export type FolderPermission = typeof folderPermission.$inferSelect;
export type NewFolderPermission = typeof folderPermission.$inferInsert;

export type GeoRule = typeof geoRule.$inferSelect;
export type NewGeoRule = typeof geoRule.$inferInsert;

// UTM Template model for storing reusable UTM parameter configurations
export const utmTemplate = mysqlTable(
  "UtmTemplate",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    utmSource: varchar("utmSource", { length: 255 }),
    utmMedium: varchar("utmMedium", { length: 255 }),
    utmCampaign: varchar("utmCampaign", { length: 255 }),
    utmTerm: varchar("utmTerm", { length: 255 }),
    utmContent: varchar("utmContent", { length: 255 }),
    userId: varchar("userId", { length: 32 }).notNull(),
    teamId: int("teamId"), // null = personal workspace, non-null = team workspace
    createdAt: timestamp("createdAt").defaultNow(),
    updatedAt: timestamp("updatedAt").onUpdateNow(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    teamIdIdx: index("teamId_idx").on(table.teamId),
  }),
);

// Define relations for UtmTemplate
export const utmTemplateRelations = relations(utmTemplate, ({ one }) => ({
  user: one(user, {
    fields: [utmTemplate.userId],
    references: [user.id],
  }),
  team: one(team, {
    fields: [utmTemplate.teamId],
    references: [team.id],
  }),
}));

export type UtmTemplate = typeof utmTemplate.$inferSelect;
export type NewUtmTemplate = typeof utmTemplate.$inferInsert;

// ============================================================================
// CAMPAIGNS
// ============================================================================

// A marketing campaign groups links (and QR codes, via their hidden backing
// links) under one initiative. Membership lives on link.campaignId (nullable
// FK, folder pattern). The campaign's slug is the default utm_campaign value;
// the other UTM columns are campaign-level defaults stamped onto member links
// at save time (Pro+).
export const campaign = mysqlTable(
  "Campaign",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(), // normalized; default utm_campaign value
    description: text("description"),
    status: mysqlEnum("status", ["active", "archived"]).notNull().default("active"),
    startDate: timestamp("startDate"),
    endDate: timestamp("endDate"),
    utmSource: varchar("utmSource", { length: 255 }),
    utmMedium: varchar("utmMedium", { length: 255 }),
    utmTerm: varchar("utmTerm", { length: 255 }),
    utmContent: varchar("utmContent", { length: 255 }),
    userId: varchar("userId", { length: 32 }).notNull(),
    teamId: int("teamId"), // null = personal workspace, non-null = team workspace
    createdByUserId: varchar("createdByUserId", { length: 32 }), // immutable original creator
    createdAt: timestamp("createdAt").defaultNow(),
    updatedAt: timestamp("updatedAt").onUpdateNow(),
    // Generated column to handle NULL teamId in the unique constraint —
    // MySQL treats NULLs as distinct (same approach as CustomDomain).
    teamIdForUnique: int("teamIdForUnique").generatedAlwaysAs(sql`COALESCE(\`teamId\`, 0)`, {
      mode: "stored",
    }),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    teamIdIdx: index("teamId_idx").on(table.teamId),
    statusIdx: index("status_idx").on(table.status),
    // DB backstop for the app-layer dup check: the slug is the campaign's
    // utm_campaign identity AND its dashboard route, so per-workspace
    // uniqueness must hold even under concurrent creates/renames.
    slugWorkspaceUnique: unique("campaign_slug_workspace_unique").on(
      table.slug,
      table.userId,
      table.teamIdForUnique,
    ),
  }),
);

export const campaignRelations = relations(campaign, ({ one, many }) => ({
  user: one(user, {
    fields: [campaign.userId],
    references: [user.id],
  }),
  team: one(team, {
    fields: [campaign.teamId],
    references: [team.id],
  }),
  links: many(link),
}));

export type Campaign = typeof campaign.$inferSelect;
export type NewCampaign = typeof campaign.$inferInsert;

// ============================================================================
// ACCOUNT TRANSFER
// ============================================================================

export const accountTransfer = mysqlTable(
  "AccountTransfer",
  {
    id: serial("id").primaryKey(),
    // Source account (Account A - transferring FROM)
    fromUserId: varchar("fromUserId", { length: 32 }).notNull(),
    // Target account (Account B - transferring TO)
    toEmail: varchar("toEmail", { length: 255 }).notNull(),
    toUserId: varchar("toUserId", { length: 32 }), // Set when target accepts
    // Security token for approval link
    token: varchar("token", { length: 64 }).notNull().unique(),
    // Transfer status
    status: mysqlEnum("status", ["pending", "accepted", "cancelled", "expired", "declined"])
      .notNull()
      .default("pending"),
    // Resource counts at time of initiation (for display to recipient)
    linksCount: int("linksCount").notNull().default(0),
    customDomainsCount: int("customDomainsCount").notNull().default(0),
    qrCodesCount: int("qrCodesCount").notNull().default(0),
    foldersCount: int("foldersCount").notNull().default(0),
    tagsCount: int("tagsCount").notNull().default(0),
    utmTemplatesCount: int("utmTemplatesCount").notNull().default(0),
    qrPresetsCount: int("qrPresetsCount").notNull().default(0),
    // Timestamps
    expiresAt: timestamp("expiresAt").notNull(),
    acceptedAt: timestamp("acceptedAt"),
    createdAt: timestamp("createdAt").defaultNow(),
  },
  (table) => ({
    fromUserIdx: index("fromUser_idx").on(table.fromUserId),
    toEmailIdx: index("toEmail_idx").on(table.toEmail),
    statusIdx: index("status_idx").on(table.status),
  }),
);

export const accountTransferRelations = relations(accountTransfer, ({ one }) => ({
  fromUser: one(user, {
    fields: [accountTransfer.fromUserId],
    references: [user.id],
    relationName: "outgoingTransfers",
  }),
  toUser: one(user, {
    fields: [accountTransfer.toUserId],
    references: [user.id],
    relationName: "incomingTransfers",
  }),
}));

export type AccountTransfer = typeof accountTransfer.$inferSelect;
export type NewAccountTransfer = typeof accountTransfer.$inferInsert;

// ============================================================================
// TEAM RELATIONS
// ============================================================================

export const teamRelations = relations(team, ({ one, many }) => ({
  owner: one(user, {
    fields: [team.ownerId],
    references: [user.id],
  }),
  members: many(teamMember),
  invites: many(teamInvite),
  links: many(link),
  folders: many(folder),
  qrcodes: many(qrcode),
  customDomains: many(customDomain),
  tags: many(tag),
  utmTemplates: many(utmTemplate),
}));

export const teamMemberRelations = relations(teamMember, ({ one }) => ({
  team: one(team, {
    fields: [teamMember.teamId],
    references: [team.id],
  }),
  user: one(user, {
    fields: [teamMember.userId],
    references: [user.id],
  }),
}));

export const teamInviteRelations = relations(teamInvite, ({ one }) => ({
  team: one(team, {
    fields: [teamInvite.teamId],
    references: [team.id],
  }),
  inviter: one(user, {
    fields: [teamInvite.invitedBy],
    references: [user.id],
  }),
}));

// Team type exports
export type Team = typeof team.$inferSelect;
export type NewTeam = typeof team.$inferInsert;

export type TeamMember = typeof teamMember.$inferSelect;
export type NewTeamMember = typeof teamMember.$inferInsert;

export type TeamInvite = typeof teamInvite.$inferSelect;
export type NewTeamInvite = typeof teamInvite.$inferInsert;

export type TeamRole = "owner" | "admin" | "member";
export type InviteRole = "admin" | "member";

export type BlockedDomain = typeof blockedDomain.$inferSelect;
export type NewBlockedDomain = typeof blockedDomain.$inferInsert;

export type FlaggedLink = typeof flaggedLink.$inferSelect;
export type NewFlaggedLink = typeof flaggedLink.$inferInsert;

// ============================================================================
// FEEDBACK
// ============================================================================

export const feedback = mysqlTable(
  "Feedback",
  {
    id: serial("id").primaryKey(),
    userId: varchar("userId", { length: 32 }).notNull(),
    type: mysqlEnum("feedbackType", ["bug", "feature", "question"]).notNull(),
    message: text("message").notNull(),
    imageUrls: json("imageUrls").$type<string[]>().default([]),
    status: mysqlEnum("feedbackStatus", ["open", "resolved", "dismissed"])
      .notNull()
      .default("open"),
    replyMessage: text("replyMessage"),
    repliedAt: timestamp("repliedAt"),
    createdAt: timestamp("createdAt").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    statusIdx: index("status_idx").on(table.status),
  }),
);

export const feedbackRelations = relations(feedback, ({ one }) => ({
  user: one(user, {
    fields: [feedback.userId],
    references: [user.id],
  }),
}));

export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;

export const audienceFeedback = mysqlTable(
  "AudienceFeedback",
  {
    id: serial("id").primaryKey(),
    userId: varchar("userId", { length: 32 }).notNull().unique(),
    role: varchar("role", { length: 64 }),
    useCase: varchar("useCase", { length: 64 }),
    monthlyVolume: varchar("monthlyVolume", { length: 64 }),
    acquisitionChannel: varchar("acquisitionChannel", { length: 64 }),
    acquisitionDetail: text("acquisitionDetail"),
    priorTool: varchar("priorTool", { length: 64 }),
    switchReason: text("switchReason"),
    magicFeature: varchar("magicFeature", { length: 64 }),
    upgradeReason: varchar("upgradeReason", { length: 64 }),
    upgradeBlocker: text("upgradeBlocker"),
    improvementWish: text("improvementWish"),
    planSnapshot: mysqlEnum("planSnapshot", ["free", "pro", "ultra"]),
    submittedAt: timestamp("submittedAt"),
    dismissedAt: timestamp("dismissedAt"),
    dismissCount: int("dismissCount").notNull().default(0),
    // The short "how did you find us" prompt for paid accounts. Kept apart from
    // submittedAt/dismissedAt so the full survey can still be offered afterwards.
    acquisitionAnsweredAt: timestamp("acquisitionAnsweredAt"),
    acquisitionDismissedAt: timestamp("acquisitionDismissedAt"),
    acquisitionDismissCount: int("acquisitionDismissCount").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow(),
    updatedAt: timestamp("updatedAt").onUpdateNow(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    submittedAtIdx: index("submittedAt_idx").on(table.submittedAt),
    acquisitionAnsweredAtIdx: index("acquisitionAnsweredAt_idx").on(table.acquisitionAnsweredAt),
  }),
);

export const audienceFeedbackRelations = relations(audienceFeedback, ({ one }) => ({
  user: one(user, {
    fields: [audienceFeedback.userId],
    references: [user.id],
  }),
}));

export type AudienceFeedback = typeof audienceFeedback.$inferSelect;
export type NewAudienceFeedback = typeof audienceFeedback.$inferInsert;

// ============================================================================
// ACCOUNT DELETION (offboarding survey + soft-delete record)
// ============================================================================

// Outlives the User row, so userId is a plain string.
export const accountDeletion = mysqlTable(
  "AccountDeletion",
  {
    id: serial("id").primaryKey(),
    userId: varchar("userId", { length: 32 }).notNull().unique(),
    email: varchar("email", { length: 255 }),
    reason: varchar("reason", { length: 64 }),
    destination: varchar("destination", { length: 64 }),
    improvement: text("improvement"),
    planSnapshot: mysqlEnum("planSnapshot", ["free", "pro", "ultra"]),
    requestedAt: timestamp("requestedAt").defaultNow(),
    restoredAt: timestamp("restoredAt"),
    purgedAt: timestamp("purgedAt"),
  },
  (table) => ({
    requestedAtIdx: index("requestedAt_idx").on(table.requestedAt),
  }),
);

export type AccountDeletion = typeof accountDeletion.$inferSelect;
export type NewAccountDeletion = typeof accountDeletion.$inferInsert;

// ============================================================================
// BIO PAGES (Link-in-Bio)
// ============================================================================

export type BioPageTheme = {
  preset?: string; // named preset id, e.g. "minimal", "midnight"
  accentColor?: string; // hex, used for buttons/links
  buttonStyle?: "rounded" | "pill" | "sharp" | "outline";
  background?: {
    type: "solid" | "gradient";
    color?: string; // solid background
    from?: string; // gradient start
    to?: string; // gradient end
  };
  font?: string; // named font key
};

export type BioSocialLink = {
  platform: string; // twitter, instagram, tiktok, youtube, github, linkedin, website, ...
  url: string;
};

export const bioPage = mysqlTable(
  "BioPage",
  {
    id: serial("id").primaryKey(),
    userId: varchar("userId", { length: 32 }).notNull(),
    teamId: int("teamId"), // null = personal workspace, non-null = team workspace
    createdByUserId: varchar("createdByUserId", { length: 32 }), // immutable original creator
    slug: varchar("slug", { length: 100 }).notNull(), // global public handle: /p/<slug>
    title: varchar("title", { length: 255 }),
    description: text("description"),
    avatarUrl: text("avatarUrl"),
    theme: json("theme").$type<BioPageTheme>(),
    socialImageUrl: text("socialImageUrl"), // Pro custom social preview (OG) image
    seoTitle: varchar("seoTitle", { length: 255 }),
    seoDescription: varchar("seoDescription", { length: 500 }),
    customDomain: varchar("customDomain", { length: 255 }), // verified custom domain to serve at its root
    removeBranding: boolean("removeBranding").default(false),
    isPublished: boolean("isPublished").default(false),
    createdAt: timestamp("createdAt").defaultNow(),
    updatedAt: timestamp("updatedAt").onUpdateNow(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    teamIdIdx: index("teamId_idx").on(table.teamId),
    slugUnique: unique("bio_slug_unique").on(table.slug), // handles are globally unique
    customDomainUnique: unique("bio_custom_domain_unique").on(table.customDomain), // one primary page per domain (NULLs are distinct)
    publishedIdx: index("isPublished_idx").on(table.isPublished),
  }),
);

export const bioBlock = mysqlTable(
  "BioBlock",
  {
    id: serial("id").primaryKey(),
    bioPageId: int("bioPageId").notNull(),
    type: mysqlEnum("blockType", [
      "link",
      "heading",
      "text",
      "social",
      "divider",
      "email",
    ]).notNull(),
    title: varchar("title", { length: 255 }), // button/heading label
    content: text("content"), // text body, or JSON array of BioSocialLink for social blocks
    url: text("url"), // destination for link blocks, email/mailto for email blocks
    linkId: int("linkId"), // backing hidden Link row for link blocks (clicks reuse the redirect pipeline)
    position: int("position").notNull().default(0),
    isVisible: boolean("isVisible").default(true).notNull(),
    scheduledAt: datetime("scheduledAt"), // Ultra: reveal at
    scheduledUntil: datetime("scheduledUntil"), // Ultra: hide after
    createdAt: timestamp("createdAt").defaultNow(),
    updatedAt: timestamp("updatedAt").onUpdateNow(),
  },
  (table) => ({
    bioPageIdIdx: index("bioPageId_idx").on(table.bioPageId),
    positionIdx: index("position_idx").on(table.bioPageId, table.position),
    linkIdIdx: index("linkId_idx").on(table.linkId),
  }),
);

// Raw bio-page view events (mirror LinkVisit). Recording consumes the owner's
// monthly event quota via reserveEventUsage; over quota the view is skipped.
export const bioPageView = mysqlTable(
  "BioPageView",
  {
    id: serial("id").primaryKey(),
    bioPageId: int("bioPageId").notNull(),
    device: varchar("device", { length: 255 }),
    browser: varchar("browser", { length: 255 }),
    os: varchar("os", { length: 255 }),
    model: varchar("model", { length: 255 }).default(""),
    referer: varchar("referer", { length: 255 }),
    country: varchar("country", { length: 255 }),
    city: varchar("city", { length: 255 }),
    continent: varchar("continent", { length: 255 }).default("N/A"),
    viewId: char("viewId", { length: 36 }), // queue message id; dedupes redelivered views
    createdAt: timestamp("createdAt").defaultNow(),
  },
  (table) => ({
    bioPageIdIdx: index("bioPageId_idx").on(table.bioPageId),
    bioPageCreatedAtIdx: index("bioPageId_createdAt_idx").on(table.bioPageId, table.createdAt),
    createdAtIdx: index("createdAt_idx").on(table.createdAt),
    viewIdIdx: unique("viewId_idx").on(table.viewId),
  }),
);

export const uniqueBioPageView = mysqlTable(
  "UniqueBioPageView",
  {
    id: serial("id").primaryKey(),
    bioPageId: int("bioPageId").notNull(),
    ipHash: char("ipHash", { length: 64 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow(),
  },
  (table) => ({
    bioPageIdIdx: index("bioPageId_idx").on(table.bioPageId),
    uniqueViewIdx: unique("unique_bio_view_idx").on(table.bioPageId, table.ipHash),
    bioPageCreatedAtIdx: index("bioPageId_createdAt_idx").on(table.bioPageId, table.createdAt),
  }),
);

// Daily rollup of bio-page views (mirror LinkVisitDailySummary), written by the
// analytics cleanup job before pruning raw rows beyond the retention window.
export const bioPageViewDailySummary = mysqlTable(
  "BioPageViewDailySummary",
  {
    id: serial("id").primaryKey(),
    bioPageId: int("bioPageId").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    views: int("views").notNull().default(0),
    uniqueViews: int("uniqueViews").notNull().default(0),
  },
  (table) => ({
    bioPageDateUnique: unique("bio_page_date_unique").on(table.bioPageId, table.date),
  }),
);

export const bioPageRelations = relations(bioPage, ({ one, many }) => ({
  user: one(user, {
    fields: [bioPage.userId],
    references: [user.id],
  }),
  team: one(team, {
    fields: [bioPage.teamId],
    references: [team.id],
  }),
  blocks: many(bioBlock),
}));

export const bioBlockRelations = relations(bioBlock, ({ one }) => ({
  bioPage: one(bioPage, {
    fields: [bioBlock.bioPageId],
    references: [bioPage.id],
  }),
  link: one(link, {
    fields: [bioBlock.linkId],
    references: [link.id],
  }),
}));

export const bioPageViewDailySummaryRelations = relations(bioPageViewDailySummary, ({ one }) => ({
  bioPage: one(bioPage, {
    fields: [bioPageViewDailySummary.bioPageId],
    references: [bioPage.id],
  }),
}));

export type BioPage = typeof bioPage.$inferSelect;
export type NewBioPage = typeof bioPage.$inferInsert;
export type BioBlock = typeof bioBlock.$inferSelect;
export type NewBioBlock = typeof bioBlock.$inferInsert;
export type BioBlockType = BioBlock["type"];
export type BioPageView = typeof bioPageView.$inferSelect;
export type NewBioPageView = typeof bioPageView.$inferInsert;

// ============================================================================
// PLAN LIMIT HITS
// ============================================================================

// One row per user, limit and UTC day when an action is rejected for plan
// reasons (or a gated screen is shown to a free user), so conversion from each
// limit can be measured. The unique key on `day` is what dedupes repeat hits.
export const planLimitHit = mysqlTable(
  "PlanLimitHit",
  {
    id: serial("id").primaryKey(),
    userId: varchar("userId", { length: 32 }).notNull(),
    limitKey: varchar("limitKey", { length: 64 }).notNull(),
    plan: mysqlEnum("plan", ["free", "pro", "ultra"]).notNull(),
    day: date("day", { mode: "string" }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    limitKeyCreatedAtIdx: index("limitKey_createdAt_idx").on(table.limitKey, table.createdAt),
    userLimitDayUnique: unique("userId_limitKey_day_unique").on(
      table.userId,
      table.limitKey,
      table.day,
    ),
  }),
);

export type PlanLimitHit = typeof planLimitHit.$inferSelect;

// One row per user and month with event usage, written by the lazy monthly reset
// (normalizeMonthlyEventCount in src/server/lib/user-plan.ts) just before it zeroes the counters,
// so recorded and dropped (over-cap) visits survive the reset.
export const monthlyUsageSnapshot = mysqlTable(
  "MonthlyUsageSnapshot",
  {
    id: serial("id").primaryKey(),
    userId: varchar("userId", { length: 32 }).notNull(),
    // YYYY-MM of the month the counts belong to.
    month: char("month", { length: 7 }).notNull(),
    recordedEventCount: int("recordedEventCount").notNull().default(0),
    droppedEventCount: int("droppedEventCount").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userMonthUnique: unique("monthlyUsageSnapshot_userId_month_unique").on(
      table.userId,
      table.month,
    ),
    monthIdx: index("monthlyUsageSnapshot_month_idx").on(table.month),
  }),
);

export type MonthlyUsageSnapshot = typeof monthlyUsageSnapshot.$inferSelect;

/** One row per hosted checkout handed to a user, so the funnel from checkout to payment can be measured. */
export const checkoutStart = mysqlTable(
  "CheckoutStart",
  {
    id: serial("id").primaryKey(),
    userId: varchar("userId", { length: 32 }).notNull(),
    plan: mysqlEnum("plan", ["pro", "ultra"]).notNull(),
    interval: mysqlEnum("interval", ["monthly", "annual"]).notNull(),
    // Pricing-page `source` param, else the visit's `utm_source`, else `auto_signup` or
    // `settings_billing`; null when none was given.
    source: varchar("source", { length: 64 }),
    // The discount code the checkout was created with; null when none was sent or the provider rejected it.
    promoCode: varchar("promoCode", { length: 64 }),
    // Which billing provider hosted the checkout; existing rows read as Lemon Squeezy.
    provider: varchar("provider", { length: 16 }).notNull().default("lemonsqueezy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    createdAtIdx: index("checkoutStart_createdAt_idx").on(table.createdAt),
    userIdIdx: index("checkoutStart_userId_idx").on(table.userId),
  }),
);

export type CheckoutStart = typeof checkoutStart.$inferSelect;

// One row per in-app cancel flow submission (cancel, downgrade or pause instead), for churn analysis.
export const subscriptionCancellation = mysqlTable(
  "SubscriptionCancellation",
  {
    id: serial("id").primaryKey(),
    userId: varchar("userId", { length: 32 }).notNull(),
    subscriptionId: int("subscriptionId").notNull(),
    fromPlan: mysqlEnum("fromPlan", ["free", "pro", "ultra"]).notNull(),
    toPlan: mysqlEnum("toPlan", ["free", "pro", "ultra"]).notNull(),
    billingInterval: mysqlEnum("billingInterval", ["monthly", "annual"]).notNull(),
    variantId: int("variantId"),
    reason: varchar("reason", { length: 64 }).notNull(),
    feedback: text("feedback"),
    // Whether the flow offered a billing pause before cancelling.
    offerShown: mysqlEnum("offerShown", ["pause", "none"]).notNull(),
    outcome: mysqlEnum("outcome", ["cancelled", "paused", "downgraded"]).notNull(),
    pauseMonths: int("pauseMonths"),
    // Paddle subscription ids are strings (`sub_…`), so they can't use the int `subscriptionId`
    // column, which stays as it is for Lemon Squeezy rows. Null on Lemon Squeezy rows.
    providerSubscriptionId: varchar("providerSubscriptionId", { length: 64 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    createdAtIdx: index("subscriptionCancellation_createdAt_idx").on(table.createdAt),
    userIdIdx: index("subscriptionCancellation_userId_idx").on(table.userId),
  }),
);

export type SubscriptionCancellation = typeof subscriptionCancellation.$inferSelect;
