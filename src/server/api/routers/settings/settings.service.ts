import { eq } from "drizzle-orm";

import { siteSettings } from "@/server/db/schema";

import type { ProtectedTRPCContext } from "../../trpc";
import type { UpdateSiteSettingsInput } from "./settings.input";

export async function getSiteSettings(ctx: ProtectedTRPCContext) {
  const settings = await ctx.db.query.siteSettings.findFirst({
    where: (table, { eq }) => eq(table.userId, ctx.auth.userId),
  });

  // If no settings exist, create default settings
  if (!settings) {
    const [newSettings] = await ctx.db.insert(siteSettings).values({
      userId: ctx.auth.userId,
      defaultDomain: "ishortn.ink",
    });

    return ctx.db.query.siteSettings.findFirst({
      where: (table, { eq }) => eq(table.id, newSettings.insertId),
    });
  }

  return settings;
}

export async function updateSiteSettings(
  ctx: ProtectedTRPCContext,
  input: UpdateSiteSettingsInput,
) {
  const existingSettings = await ctx.db.query.siteSettings.findFirst({
    where: (table, { eq }) => eq(table.userId, ctx.auth.userId),
  });

  // If domain is not ishortn.ink, verify that the user owns the domain
  if (input.defaultDomain !== "ishortn.ink") {
    const domain = await ctx.db.query.customDomain.findFirst({
      where: (table, { and }) =>
        and(
          eq(table.userId, ctx.auth.userId),
          eq(table.domain, input.defaultDomain),
          eq(table.status, "active"),
        ),
    });

    if (!domain) {
      throw new Error("You can only set verified custom domains as your default domain");
    }
  }

  if (existingSettings) {
    await ctx.db.update(siteSettings).set(input).where(eq(siteSettings.userId, ctx.auth.userId));
  } else {
    await ctx.db.insert(siteSettings).values({
      userId: ctx.auth.userId,
      ...input,
    });
  }

  return getSiteSettings(ctx);
}
