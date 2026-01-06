/**
 * Link Password operations
 * Handles password verification and management for protected links
 */

import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";

import { retrieveDeviceAndGeolocationData } from "@/lib/core/analytics";
import { deleteFromCache } from "@/lib/core/cache";
import { link, linkVisit, uniqueLinkVisit } from "@/server/db/schema";
import { workspaceFilter } from "@/server/lib/workspace";

import { constructCacheKey } from "./link-shared";

import type { db } from "@/server/db";
import type { WorkspaceTRPCContext } from "../../../trpc";

export const verifyLinkPassword = async (
  ctx: { db: typeof db; headers: Headers },
  input: { id: number; password: string }
) => {
  const foundLink = await ctx.db.query.link.findFirst({
    where: (table, { eq }) => eq(table.id, input.id),
  });

  if (!foundLink?.passwordHash) {
    return null;
  }

  const isPasswordCorrect = await bcrypt.compare(
    input.password,
    foundLink.passwordHash
  );

  if (!isPasswordCorrect) {
    return null;
  }

  const deviceDetails = await retrieveDeviceAndGeolocationData(ctx.headers);
  const ipHash = crypto
    .createHash("sha256")
    .update(ctx.headers.get("x-forwarded-for") ?? "")
    .digest("hex");
  const existingLinkVisit = await ctx.db.query.uniqueLinkVisit.findFirst({
    where: (table, { eq, and }) =>
      and(eq(table.linkId, foundLink.id), eq(table.ipHash, ipHash)),
  });

  if (!existingLinkVisit) {
    await ctx.db.insert(uniqueLinkVisit).values({
      linkId: foundLink.id,
      ipHash,
    });
  }

  await ctx.db.insert(linkVisit).values({
    linkId: foundLink.id,
    ...deviceDetails,
  });

  return foundLink;
};

export const changeLinkPassword = async (
  ctx: WorkspaceTRPCContext,
  input: { id: number; password: string }
) => {
  const passwordHash = await bcrypt.hash(input.password, 10);

  await ctx.db
    .update(link)
    .set({
      passwordHash,
    })
    .where(and(eq(link.id, input.id), workspaceFilter(ctx.workspace, link.userId, link.teamId)));

  const updatedLink = await ctx.db.query.link.findFirst({
    where: and(
      eq(link.id, input.id),
      workspaceFilter(ctx.workspace, link.userId, link.teamId)
    ),
  });

  await deleteFromCache(
    constructCacheKey(updatedLink!.domain, updatedLink!.alias!)
  );

  return updatedLink;
};
