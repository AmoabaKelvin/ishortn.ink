import { relations } from "drizzle-orm";
import {
	boolean,
	datetime,
	index,
	int,
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
    }).unique(),
    createdAt: timestamp("createdAt").defaultNow(),
    disableLinkAfterClicks: int("disableLinkAfterClicks"),
    disableLinkAfterDate: datetime("disableLinkAfterDate"),
    disabled: boolean("disabled").default(false),
    publicStats: boolean("publicStats").default(false),
    userId: varchar("userId", {
      length: 32,
    }).notNull(),
    passwordHash: text("passwordHash"),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
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
    country: varchar("country", { length: 255 }),
    city: varchar("city", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow(),
  },
  (table) => ({
    linkIdIdx: index("linkId_idx").on(table.linkId),
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

// QRCODE
export const qrcode = mysqlTable(
  "QrCode",
  {
    id: serial("id").primaryKey(),
    linkId: int("linkId"), // we will create a short link for whatever destination url the user provides
    qrCode: text("qrCode"), // the qr code image: will be stored as a base64 string
    title: varchar("title", { length: 255 }).default(""),
    createdAt: timestamp("createdAt").defaultNow(),
    userId: varchar("userId", { length: 32 }).notNull(),

    // we need to store the presets for the qrcode in order to view the previous styles used when modifying the qrcode
    // the presets will be stored as a JSON string
    qrPatternType: mysqlEnum("qrPatternType", ["dots", "squares", "fluid"]),
    qrForegroundColor: varchar("qrForegroundColor", { length: 255 }).default("#000000"),
    qrEyesColor: varchar("qrEyesColor", { length: 255 }).default("#000000"),
    qrEyesBorderRadius: int("qrEyesBorderRadius").default(0),
  },
  (table) => ({
    linkIdIdx: index("linkId_idx").on(table.linkId),
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
}));

export const userRelations = relations(user, ({ many, one }) => ({
  links: many(link),
  tokens: one(token, {
    fields: [user.id],
    references: [token.userId],
  }),
  qrcodes: many(qrcode),
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

export type Link = typeof link.$inferSelect;
export type NewLink = typeof link.$inferInsert;

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

export type LinkVisit = typeof linkVisit.$inferSelect;
export type NewLinkVisit = typeof linkVisit.$inferInsert;

export type Token = typeof token.$inferSelect;
export type NewToken = typeof token.$inferInsert;

export type Subscription = typeof subscription.$inferSelect;
export type NewSubscription = typeof subscription.$inferInsert;

export type QrCode = typeof qrcode.$inferSelect;
export type NewQrCode = typeof qrcode.$inferInsert;

// DynamicLink model
// export const dynamicLink = mysqlTable(
//   "DynamicLink",
//   {
//     id: serial("id").primaryKey(),
//     name: varchar("name"),
//     subdomain: varchar("subdomain").unique(),
//     createdAt: datetime("createdAt").defaultNow(),
//     playStoreUrl: varchar("playStoreUrl").default(""),
//     appStoreUrl: varchar("appStoreUrl").default(""),
//     iosTeamId: varchar("iosTeamId").default(""),
//     iosBundleId: varchar("iosBundleId").default(""),
//     androidPackageName: varchar("androidPackageName").default(""),
//     androidSha256Fingerprint: varchar("androidSha256Fingerprint").default(""),
//     userId: varchar("userId").references(() => user.id),
//   },
//   (table) => ({
//     userIdIdx: index("userId_idx").on(table.userId),
//   }),
// );

// // DynamicLinkChildLink model
// export const dynamicLinkChildLink = mysqlTable(
//   "DynamicLinkChildLink",
//   {
//     id: serial("id").primaryKey(),
//     dynamicLinkId: int("dynamicLinkId").references(() => dynamicLink.id),
//     createdAt: datetime("createdAt").defaultNow(),
//     metaDataTitle: varchar("metaDataTitle").default(""),
//     metaDataDescription: varchar("metaDataDescription").default(""),
//     metaDataImageUrl: text("metaDataImageUrl"),
//     shortLink: varchar("shortLink"),
//     link: text("link"),
//     fallbackLink: text("fallbackLink"),
//     createdFromUI: boolean("createdFromUI").default(false),
//   },
//   (table) => ({
//     dynamicLinkIdIdx: index("dynamicLinkId_idx").on(table.dynamicLinkId),
//   }),
// );
