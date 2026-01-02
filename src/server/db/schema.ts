import { relations } from "drizzle-orm";
import {
  boolean,
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
    defaultDomain: varchar("defaultDomain", { length: 255 }).default(
      "ishortn.ink"
    ),
    ownerId: varchar("ownerId", { length: 32 }).notNull(), // Ultra user who created the team
    createdAt: timestamp("createdAt").defaultNow(),
    updatedAt: timestamp("updatedAt").onUpdateNow(),
    deletedAt: timestamp("deletedAt"), // Soft delete timestamp for grace period cleanup
  },
  (table) => ({
    slugIdx: index("slug_idx").on(table.slug),
    ownerIdIdx: index("ownerId_idx").on(table.ownerId),
    deletedAtIdx: index("deletedAt_idx").on(table.deletedAt), // Index for cleanup job queries
  })
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
  })
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
    createdAt: timestamp("createdAt").defaultNow(),
  },
  (table) => ({
    tokenIdx: index("token_idx").on(table.token),
    teamIdx: index("team_idx").on(table.teamId),
  })
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
  monthlyEventCount: int("monthlyEventCount").default(0),
  lastEventCountReset: timestamp("lastEventCountReset").defaultNow(),
  eventUsageAlertLevel: int("eventUsageAlertLevel").default(0),
  lastViewedChangelogSlug: varchar("lastViewedChangelogSlug", { length: 100 }),
},
(table) => ({
  userIdx: index("userId_idx").on(table.id),
})
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
  variantId: int("variantId").default(0),
  productId: int("productId").default(0),

  // details about the payment to show in the dashboard
  cardBrand: varchar("cardBrand", { length: 255 }).default(""),
  cardLastFour: varchar("cardLastFour", { length: 4 }).default(""),
},
  (table) => ({
    userIdx: index("userId_idx").on(table.userId),
  })
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
    disableLinkAfterDate: datetime("disableLinkAfterDate"),
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
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    teamIdIdx: index("teamId_idx").on(table.teamId),
    aliasDomainIdx: index("aliasDomain_idx").on(table.alias, table.domain),
    uniqueAliasDomainIdx: unique("unique_alias_domain").on(
      table.alias,
      table.domain
    ), // we have to have unique entries for alias and domain. so that we can't have two links with the same alias and domain
    folderIdIdx: index("folderId_idx").on(table.folderId),
  })
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
    createdAt: timestamp("createdAt").defaultNow(),
  },
  (table) => ({
    linkIdIdx: index("linkId_idx").on(table.linkId),
  })
);

export const uniqueLinkVisit = mysqlTable(
  "UniqueLinkVisit",
  {
    id: serial("id").primaryKey(),
    linkId: int("linkId").notNull(),
    ipHash: varchar("ipHash", { length: 255 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow(),
  },
  (table) => ({
    linkIdIdx: index("linkId_idx").on(table.linkId),
    ipHashIdx: index("ipHash_idx").on(table.ipHash),
    uniqueVisitIdx: index("unique_visit_idx").on(table.linkId, table.ipHash),
  })
);

export const token = mysqlTable(
  "Token",
  {
    id: serial("id").primaryKey(),
    token: text("token"),
    createdAt: timestamp("createdAt").defaultNow(),
    userId: varchar("userId", { length: 32 }).notNull(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
  })
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
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    teamIdIdx: index("teamId_idx").on(table.teamId),
  })
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
    markerShape: varchar("markerShape", { length: 50 }).notNull().default("square"),
    markerInnerShape: varchar("markerInnerShape", { length: 50 }).notNull().default("auto"),
    darkColor: varchar("darkColor", { length: 9 }).notNull().default("#000000"),
    lightColor: varchar("lightColor", { length: 9 }).notNull().default("#ffffff"),

    // Effect settings
    effect: varchar("effect", { length: 50 }).notNull().default("none"),
    effectRadius: int("effectRadius").notNull().default(12),

    // Margin noise settings
    marginNoise: boolean("marginNoise").notNull().default(false),
    marginNoiseRate: varchar("marginNoiseRate", { length: 10 }).notNull().default("0.5"),

    createdAt: timestamp("createdAt").defaultNow(),
    updatedAt: timestamp("updatedAt").onUpdateNow(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    teamIdIdx: index("teamId_idx").on(table.teamId),
  })
);

export const siteSettings = mysqlTable(
  "SiteSettings",
  {
    id: serial("id").primaryKey(),
    userId: varchar("userId", { length: 32 }).notNull(),
    teamId: int("teamId"), // null = personal workspace, non-null = team workspace
    defaultDomain: varchar("defaultDomain", { length: 255 }).default(
      "ishortn.ink"
    ),
    createdAt: timestamp("createdAt").defaultNow(),
    updatedAt: timestamp("updatedAt").onUpdateNow(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    teamIdIdx: index("teamId_idx").on(table.teamId),
  })
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
  })
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
  })
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
    folderIdIdx: index("folderId_idx").on(table.folderId),
    userIdIdx: index("userId_idx").on(table.userId),
  })
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
    linkIdIdx: index("linkId_idx").on(table.linkId),
    tagIdIdx: index("tagId_idx").on(table.tagId),
  })
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
}));

export const customDomain = mysqlTable(
  "CustomDomain",
  {
    id: serial("id").primaryKey(),
    domain: varchar("domain", { length: 255 }),
    userId: varchar("userId", { length: 32 }).notNull(),
    teamId: int("teamId"), // null = personal workspace, non-null = team workspace
    createdAt: timestamp("createdAt").defaultNow(),
    status: mysqlEnum("status", ["pending", "active", "invalid"]).default(
      "pending"
    ),
    verificationDetails: json("verificationDetails"),
    lastReminderSentAt: timestamp("lastReminderSentAt"),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    teamIdIdx: index("teamId_idx").on(table.teamId),
    // Allow the same domain in different workspaces, but not in the same workspace twice
    domainWorkspaceUnique: unique("domain_workspace_unique").on(
      table.domain,
      table.userId,
      table.teamId
    ),
  })
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
}));

export const linkVisitRelations = relations(linkVisit, ({ one }) => ({
  link: one(link, {
    fields: [linkVisit.linkId],
    references: [link.id],
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

export const uniqueLinkVisitRelations = relations(
  uniqueLinkVisit,
  ({ one }) => ({
    link: one(link, {
      fields: [uniqueLinkVisit.linkId],
      references: [link.id],
    }),
  })
);

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
  })
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
