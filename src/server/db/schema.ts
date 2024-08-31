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
	serial,
	text,
	timestamp,
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
  },
  (table) => ({
    userIdx: index("userId_idx").on(table.id),
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

    // details about the payment to show in the dashboard
    cardBrand: varchar("cardBrand", { length: 255 }).default(""),
    cardLastFour: varchar("cardLastFour", { length: 4 }).default(""),
  },
  (table) => ({
    userIdx: index("userId_idx").on(table.userId),
  }),
);

export const link = mysqlTable(
  "Link",
  {
    id: serial("id").primaryKey(),
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
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    aliasDomainIdx: index("aliasDomain_idx").on(table.alias, table.domain),
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
    createdAt: timestamp("createdAt").defaultNow(),
  },
  (table) => ({
    linkIdIdx: index("linkId_idx").on(table.linkId),
  }),
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
  }),
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
  }),
);

// Define relations
export const linkRelations = relations(link, ({ one, many }) => ({
  user: one(user, {
    fields: [link.userId],
    references: [user.id],
  }),
  linkVisits: many(linkVisit),
  uniqueLinkVisits: many(uniqueLinkVisit),
}));

export const customDomain = mysqlTable(
  "CustomDomain",
  {
    id: serial("id").primaryKey(),
    domain: varchar("domain", { length: 255 }).unique(),
    userId: varchar("userId", { length: 32 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow(),
    status: mysqlEnum("status", ["pending", "active", "invalid"]).default("pending"),
    verificationDetails: json("verificationDetails"),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
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

export const uniqueLinkVisitRelations = relations(uniqueLinkVisit, ({ one }) => ({
  link: one(link, { fields: [uniqueLinkVisit.linkId], references: [link.id] }),
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
