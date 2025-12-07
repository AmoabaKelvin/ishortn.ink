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
    passwordHash: text("passwordHash"),
    note: varchar("note", { length: 255 }),
    metadata: json("metadata"),
    tags: json("tags").$type<string[]>().default([]),
    archived: boolean("archived").default(false),
    folderId: int("folderId"),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
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
  })
);

export const siteSettings = mysqlTable(
  "SiteSettings",
  {
    id: serial("id").primaryKey(),
    userId: varchar("userId", { length: 32 }).notNull(),
    defaultDomain: varchar("defaultDomain", { length: 255 }).default(
      "ishortn.ink"
    ),
    createdAt: timestamp("createdAt").defaultNow(),
    updatedAt: timestamp("updatedAt").onUpdateNow(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
  })
);

// Tag model for storing unique tags
export const tag = mysqlTable(
  "Tag",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 50 }).notNull().unique(),
    createdAt: timestamp("createdAt").defaultNow(),
    userId: varchar("userId", { length: 32 }).notNull(),
  },
  (table) => ({
    nameIdx: index("name_idx").on(table.name),
    userIdIdx: index("userId_idx").on(table.userId),
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
    createdAt: timestamp("createdAt").defaultNow(),
    updatedAt: timestamp("updatedAt").onUpdateNow(),
  },
  (table) => ({
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
    domain: varchar("domain", { length: 255 }).unique(),
    userId: varchar("userId", { length: 32 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow(),
    status: mysqlEnum("status", ["pending", "active", "invalid"]).default(
      "pending"
    ),
    verificationDetails: json("verificationDetails"),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
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
}));

// Define relations for Tag
export const tagRelations = relations(tag, ({ many, one }) => ({
  user: one(user, {
    fields: [tag.userId],
    references: [user.id],
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
  links: many(link),
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
