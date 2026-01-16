import { TRPCError } from "@trpc/server";
import { addDays } from "date-fns";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import crypto from "node:crypto";

import { getPlanCaps, resolvePlan } from "@/lib/billing/plans";
import type { Plan } from "@/lib/billing/plans";
import {
  accountTransfer,
  customDomain,
  folder,
  link,
  linkTag,
  qrcode,
  qrPreset,
  tag,
  user,
  utmTemplate,
} from "@/server/db/schema";
import { sendAccountTransferEmail } from "@/server/lib/notifications/account-transfer";

import type { ProtectedTRPCContext } from "../../trpc";
import type {
  InitiateTransferInput,
  AcceptTransferInput,
  CancelTransferInput,
} from "./account-transfer.input";

// ============================================================================
// TYPES
// ============================================================================

export interface ResourceCounts {
  links: number;
  customDomains: number;
  qrCodes: number;
  folders: number;
  tags: number;
  utmTemplates: number;
  qrPresets: number;
}

export interface TransferValidationResult {
  isValid: boolean;
  errors: Array<{
    type:
      | "TARGET_NOT_FOUND"
      | "SAME_ACCOUNT"
      | "PENDING_TRANSFER_EXISTS"
      | "LIMIT_EXCEEDED"
      | "TARGET_DELETED";
    message: string;
    resourceType?: string;
    currentCount?: number;
    limit?: number;
  }>;
  resourceCounts: ResourceCounts;
  targetUserId?: string;
  targetPlan?: Plan;
}

export interface TransferResult {
  success: boolean;
  linksTransferred: number;
  customDomainsTransferred: number;
  qrCodesTransferred: number;
  foldersTransferred: number;
  foldersCreated: number;
  foldersMerged: number;
  tagsTransferred: number;
  tagsCreated: number;
  tagsMerged: number;
  utmTemplatesTransferred: number;
  qrPresetsTransferred: number;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Count all transferable resources in the user's personal workspace
 */
async function countUserResources(
  userId: string,
  db: ProtectedTRPCContext["db"]
): Promise<ResourceCounts> {
  const [links, domains, qrCodes, folders, tags, utmTemplates, qrPresets] =
    await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(link)
        .where(and(eq(link.userId, userId), isNull(link.teamId))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(customDomain)
        .where(and(eq(customDomain.userId, userId), isNull(customDomain.teamId))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(qrcode)
        .where(and(eq(qrcode.userId, userId), isNull(qrcode.teamId))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(folder)
        .where(and(eq(folder.userId, userId), isNull(folder.teamId))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(tag)
        .where(and(eq(tag.userId, userId), isNull(tag.teamId))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(utmTemplate)
        .where(and(eq(utmTemplate.userId, userId), isNull(utmTemplate.teamId))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(qrPreset)
        .where(and(eq(qrPreset.userId, userId), isNull(qrPreset.teamId))),
    ]);

  return {
    links: Number(links[0]?.count ?? 0),
    customDomains: Number(domains[0]?.count ?? 0),
    qrCodes: Number(qrCodes[0]?.count ?? 0),
    folders: Number(folders[0]?.count ?? 0),
    tags: Number(tags[0]?.count ?? 0),
    utmTemplates: Number(utmTemplates[0]?.count ?? 0),
    qrPresets: Number(qrPresets[0]?.count ?? 0),
  };
}

/**
 * Validate if account transfer is possible
 * - Target account must exist
 * - Cannot transfer to self
 * - No pending transfer exists
 * - Target plan must accommodate resources
 */
export async function validateAccountTransfer(
  ctx: ProtectedTRPCContext,
  targetEmail: string
): Promise<TransferValidationResult> {
  const errors: TransferValidationResult["errors"] = [];

  // Get source user
  const sourceUser = await ctx.db.query.user.findFirst({
    where: eq(user.id, ctx.auth.userId),
  });

  if (!sourceUser) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Source account not found",
    });
  }

  // Check not transferring to self
  if (sourceUser.email?.toLowerCase() === targetEmail.toLowerCase()) {
    errors.push({
      type: "SAME_ACCOUNT",
      message: "Cannot transfer account to yourself",
    });
    return {
      isValid: false,
      errors,
      resourceCounts: {
        links: 0,
        customDomains: 0,
        qrCodes: 0,
        folders: 0,
        tags: 0,
        utmTemplates: 0,
        qrPresets: 0,
      },
    };
  }

  // Check target account exists
  const targetUser = await ctx.db.query.user.findFirst({
    where: eq(user.email, targetEmail.toLowerCase()),
    with: { subscriptions: true },
  });

  if (!targetUser) {
    errors.push({
      type: "TARGET_NOT_FOUND",
      message:
        "Target account does not exist. The recipient must sign up first.",
    });
    return {
      isValid: false,
      errors,
      resourceCounts: {
        links: 0,
        customDomains: 0,
        qrCodes: 0,
        folders: 0,
        tags: 0,
        utmTemplates: 0,
        qrPresets: 0,
      },
    };
  }

  // Check target account is not soft-deleted
  if (targetUser.deletedAt !== null) {
    errors.push({
      type: "TARGET_DELETED",
      message:
        "Target account is marked for deletion and cannot receive transfers",
    });
    return {
      isValid: false,
      errors,
      resourceCounts: {
        links: 0,
        customDomains: 0,
        qrCodes: 0,
        folders: 0,
        tags: 0,
        utmTemplates: 0,
        qrPresets: 0,
      },
    };
  }

  // Check for existing pending transfer
  const existingTransfer = await ctx.db.query.accountTransfer.findFirst({
    where: and(
      eq(accountTransfer.fromUserId, ctx.auth.userId),
      eq(accountTransfer.status, "pending")
    ),
  });

  if (existingTransfer) {
    errors.push({
      type: "PENDING_TRANSFER_EXISTS",
      message:
        "You already have a pending account transfer. Cancel it before initiating a new one.",
    });
    return {
      isValid: false,
      errors,
      resourceCounts: {
        links: 0,
        customDomains: 0,
        qrCodes: 0,
        folders: 0,
        tags: 0,
        utmTemplates: 0,
        qrPresets: 0,
      },
    };
  }

  // Get target user's plan
  const targetPlan = resolvePlan(targetUser.subscriptions ?? null);
  const targetCaps = getPlanCaps(targetPlan);

  // Count source resources
  const resourceCounts = await countUserResources(ctx.auth.userId, ctx.db);

  // Get target's current counts
  const targetCurrentCounts = await countUserResources(targetUser.id, ctx.db);

  // Check limits - BLOCK entire transfer if ANY resource would exceed caps
  if (targetCaps.linksLimit !== undefined) {
    const newTotal = targetCurrentCounts.links + resourceCounts.links;
    if (newTotal > targetCaps.linksLimit) {
      errors.push({
        type: "LIMIT_EXCEEDED",
        message: `Transfer would exceed target account's link limit`,
        resourceType: "links",
        currentCount: newTotal,
        limit: targetCaps.linksLimit,
      });
    }
  }

  if (targetCaps.domainLimit !== undefined && resourceCounts.customDomains > 0) {
    const newTotal =
      targetCurrentCounts.customDomains + resourceCounts.customDomains;
    if (newTotal > targetCaps.domainLimit) {
      errors.push({
        type: "LIMIT_EXCEEDED",
        message: `Transfer would exceed target account's custom domain limit`,
        resourceType: "customDomains",
        currentCount: newTotal,
        limit: targetCaps.domainLimit,
      });
    }
  }

  if (targetCaps.folderLimit !== undefined && resourceCounts.folders > 0) {
    // For folders, we need to account for potential merges
    // Get folder names from both accounts to see overlap
    const [sourceFolders, targetFolders] = await Promise.all([
      ctx.db.query.folder.findMany({
        where: and(eq(folder.userId, ctx.auth.userId), isNull(folder.teamId)),
        columns: { name: true },
      }),
      ctx.db.query.folder.findMany({
        where: and(eq(folder.userId, targetUser.id), isNull(folder.teamId)),
        columns: { name: true },
      }),
    ]);

    const targetFolderNames = new Set(
      targetFolders.map((f) => f.name.toLowerCase())
    );
    const newFoldersCount = sourceFolders.filter(
      (f) => !targetFolderNames.has(f.name.toLowerCase())
    ).length;

    const newTotal = targetCurrentCounts.folders + newFoldersCount;
    if (newTotal > targetCaps.folderLimit) {
      errors.push({
        type: "LIMIT_EXCEEDED",
        message: `Transfer would exceed target account's folder limit`,
        resourceType: "folders",
        currentCount: newTotal,
        limit: targetCaps.folderLimit,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    resourceCounts,
    targetUserId: targetUser.id,
    targetPlan,
  };
}

// ============================================================================
// INITIATE TRANSFER
// ============================================================================

export async function initiateAccountTransfer(
  ctx: ProtectedTRPCContext,
  input: InitiateTransferInput
) {
  // Validate the transfer
  const validation = await validateAccountTransfer(ctx, input.targetEmail);

  if (!validation.isValid) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: validation.errors[0]?.message ?? "Transfer validation failed",
      cause: { blockers: validation.errors },
    });
  }

  // Generate secure token
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = addDays(new Date(), 7); // 7 day expiry

  // Create transfer record
  const [result] = await ctx.db.insert(accountTransfer).values({
    fromUserId: ctx.auth.userId,
    toEmail: input.targetEmail.toLowerCase(),
    toUserId: validation.targetUserId,
    token,
    status: "pending",
    linksCount: validation.resourceCounts.links,
    customDomainsCount: validation.resourceCounts.customDomains,
    qrCodesCount: validation.resourceCounts.qrCodes,
    foldersCount: validation.resourceCounts.folders,
    tagsCount: validation.resourceCounts.tags,
    utmTemplatesCount: validation.resourceCounts.utmTemplates,
    qrPresetsCount: validation.resourceCounts.qrPresets,
    expiresAt,
  });

  // Get source user details for email
  const sourceUser = await ctx.db.query.user.findFirst({
    where: eq(user.id, ctx.auth.userId),
    columns: { name: true, email: true },
  });

  const targetUser = await ctx.db.query.user.findFirst({
    where: eq(user.id, validation.targetUserId!),
    columns: { name: true },
  });

  // Send email to target account
  void sendAccountTransferEmail({
    toEmail: input.targetEmail,
    toName: targetUser?.name,
    fromEmail: sourceUser?.email ?? "unknown",
    fromName: sourceUser?.name ?? "A user",
    token,
    resourceCounts: validation.resourceCounts,
  });

  return {
    transferId: Number(result.insertId),
    token,
    expiresAt,
    resourceCounts: validation.resourceCounts,
  };
}

// ============================================================================
// GET TRANSFER INFO
// ============================================================================

export async function getTransferByToken(
  ctx: ProtectedTRPCContext,
  token: string
) {
  const transfer = await ctx.db.query.accountTransfer.findFirst({
    where: eq(accountTransfer.token, token),
    with: {
      fromUser: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!transfer) {
    return null;
  }

  return {
    id: transfer.id,
    fromUser: {
      name: transfer.fromUser.name,
      email: transfer.fromUser.email,
    },
    status: transfer.status,
    resourceCounts: {
      links: transfer.linksCount,
      customDomains: transfer.customDomainsCount,
      qrCodes: transfer.qrCodesCount,
      folders: transfer.foldersCount,
      tags: transfer.tagsCount,
      utmTemplates: transfer.utmTemplatesCount,
      qrPresets: transfer.qrPresetsCount,
    },
    expiresAt: transfer.expiresAt,
    acceptedAt: transfer.acceptedAt,
    isExpired: transfer.expiresAt < new Date(),
    isAccepted: !!transfer.acceptedAt,
    isCancelled: transfer.status === "cancelled",
  };
}

export async function getPendingTransfer(ctx: ProtectedTRPCContext) {
  const transfer = await ctx.db.query.accountTransfer.findFirst({
    where: and(
      eq(accountTransfer.fromUserId, ctx.auth.userId),
      eq(accountTransfer.status, "pending")
    ),
  });

  if (!transfer) {
    return null;
  }

  return {
    id: transfer.id,
    targetEmail: transfer.toEmail,
    status: transfer.status,
    resourceCounts: {
      links: transfer.linksCount,
      customDomains: transfer.customDomainsCount,
      qrCodes: transfer.qrCodesCount,
      folders: transfer.foldersCount,
      tags: transfer.tagsCount,
      utmTemplates: transfer.utmTemplatesCount,
      qrPresets: transfer.qrPresetsCount,
    },
    expiresAt: transfer.expiresAt,
    createdAt: transfer.createdAt,
    isExpired: transfer.expiresAt < new Date(),
  };
}

/**
 * Get account deletion status for current user
 */
export async function getAccountStatus(ctx: ProtectedTRPCContext) {
  const userRecord = await ctx.db.query.user.findFirst({
    where: eq(user.id, ctx.auth.userId),
    columns: { deletedAt: true },
  });

  return {
    isScheduledForDeletion: userRecord?.deletedAt != null,
    deletedAt: userRecord?.deletedAt ?? null,
  };
}

// ============================================================================
// ACCEPT TRANSFER (Execute Resource Migration)
// ============================================================================

export async function acceptAccountTransfer(
  ctx: ProtectedTRPCContext,
  input: AcceptTransferInput
): Promise<TransferResult> {
  const transfer = await ctx.db.query.accountTransfer.findFirst({
    where: eq(accountTransfer.token, input.token),
  });

  if (!transfer) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Invalid transfer token",
    });
  }

  // Verify current user is the target
  const currentUser = await ctx.db.query.user.findFirst({
    where: eq(user.id, ctx.auth.userId),
  });

  if (currentUser?.email?.toLowerCase() !== transfer.toEmail.toLowerCase()) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This transfer is for a different account",
    });
  }

  if (transfer.status !== "pending") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `This transfer is ${transfer.status} and cannot be accepted`,
    });
  }

  if (transfer.expiresAt < new Date()) {
    // Mark as expired
    await ctx.db
      .update(accountTransfer)
      .set({ status: "expired" })
      .where(eq(accountTransfer.id, transfer.id));

    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This transfer has expired",
    });
  }

  // Re-validate (plan caps may have changed)
  // Create a temporary context with the source user to validate
  const sourceUserContext = {
    ...ctx,
    auth: { ...ctx.auth, userId: transfer.fromUserId },
  } as ProtectedTRPCContext;

  const revalidation = await validateAccountTransfer(
    sourceUserContext,
    transfer.toEmail
  );

  if (!revalidation.isValid) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Transfer validation failed. Plan limits may have changed. " +
        revalidation.errors.map((e) => e.message).join(". "),
      cause: { blockers: revalidation.errors },
    });
  }

  // Execute transfer in transaction
  const result = await executeResourceTransfer(
    ctx,
    transfer.fromUserId,
    ctx.auth.userId,
    transfer.id
  );

  return result;
}

/**
 * Execute the actual resource transfer
 */
async function executeResourceTransfer(
  ctx: ProtectedTRPCContext,
  fromUserId: string,
  toUserId: string,
  transferId: number
): Promise<TransferResult> {
  const result: TransferResult = {
    success: true,
    linksTransferred: 0,
    customDomainsTransferred: 0,
    qrCodesTransferred: 0,
    foldersTransferred: 0,
    foldersCreated: 0,
    foldersMerged: 0,
    tagsTransferred: 0,
    tagsCreated: 0,
    tagsMerged: 0,
    utmTemplatesTransferred: 0,
    qrPresetsTransferred: 0,
  };

  await ctx.db.transaction(async (tx) => {
    // =========================================
    // Phase 1: Handle Folders (by name merge)
    // =========================================
    const sourceFolders = await tx.query.folder.findMany({
      where: and(eq(folder.userId, fromUserId), isNull(folder.teamId)),
    });

    const targetFolders = await tx.query.folder.findMany({
      where: and(eq(folder.userId, toUserId), isNull(folder.teamId)),
    });

    const targetFoldersByName = new Map(
      targetFolders.map((f) => [f.name.toLowerCase(), f])
    );

    const folderIdMapping = new Map<number, number>(); // source ID -> target ID

    for (const sourceFolder of sourceFolders) {
      const folderNameKey = sourceFolder.name.toLowerCase();
      const existingTargetFolder = targetFoldersByName.get(folderNameKey);

      if (existingTargetFolder) {
        // Merge: map source folder ID to existing target folder ID
        folderIdMapping.set(sourceFolder.id, existingTargetFolder.id);
        result.foldersMerged++;
      } else {
        // Create new folder in target account
        const [newFolder] = await tx.insert(folder).values({
          name: sourceFolder.name,
          description: sourceFolder.description,
          userId: toUserId,
          teamId: null,
          isRestricted: false, // Reset restriction (no team context)
        });
        const newFolderId = Number(newFolder.insertId);
        folderIdMapping.set(sourceFolder.id, newFolderId);
        targetFoldersByName.set(folderNameKey, { ...sourceFolder, id: newFolderId });
        result.foldersCreated++;
      }
    }

    result.foldersTransferred = sourceFolders.length;

    // =========================================
    // Phase 2: Handle Tags (by name merge)
    // =========================================
    const sourceTags = await tx.query.tag.findMany({
      where: and(eq(tag.userId, fromUserId), isNull(tag.teamId)),
    });

    const targetTags = await tx.query.tag.findMany({
      where: and(eq(tag.userId, toUserId), isNull(tag.teamId)),
    });

    const targetTagsByName = new Map(
      targetTags.map((t) => [t.name.toLowerCase(), t])
    );

    const tagIdMapping = new Map<number, number>(); // source ID -> target ID

    for (const sourceTag of sourceTags) {
      const tagNameKey = sourceTag.name.toLowerCase();
      const existingTargetTag = targetTagsByName.get(tagNameKey);

      if (existingTargetTag) {
        // Merge: map source tag ID to existing target tag ID
        tagIdMapping.set(sourceTag.id, existingTargetTag.id);
        result.tagsMerged++;
      } else {
        // Create new tag in target account
        const [newTag] = await tx.insert(tag).values({
          name: sourceTag.name,
          userId: toUserId,
          teamId: null,
        });
        const newTagId = Number(newTag.insertId);
        tagIdMapping.set(sourceTag.id, newTagId);
        targetTagsByName.set(tagNameKey, { ...sourceTag, id: newTagId });
        result.tagsCreated++;
      }
    }

    result.tagsTransferred = sourceTags.length;

    // =========================================
    // Phase 3: Transfer Links (with folder remapping)
    // =========================================
    const sourceLinks = await tx.query.link.findMany({
      where: and(eq(link.userId, fromUserId), isNull(link.teamId)),
    });

    if (sourceLinks.length > 0) {
      const linkIds = sourceLinks.map((l) => l.id);

      // Get all link-tag associations for these links
      const sourceLinkTags = await tx.query.linkTag.findMany({
        where: inArray(linkTag.linkId, linkIds),
      });

      // Update links ownership and folder IDs
      for (const sourceLink of sourceLinks) {
        const newFolderId = sourceLink.folderId
          ? folderIdMapping.get(sourceLink.folderId) ?? null
          : null;

        await tx
          .update(link)
          .set({
            userId: toUserId,
            teamId: null,
            folderId: newFolderId,
          })
          .where(eq(link.id, sourceLink.id));
      }

      // Delete old link-tag associations
      if (sourceLinkTags.length > 0) {
        await tx.delete(linkTag).where(inArray(linkTag.linkId, linkIds));
      }

      // Recreate link-tag associations with new tag IDs
      const newLinkTags: Array<{ linkId: number; tagId: number }> = [];
      for (const lt of sourceLinkTags) {
        const newTagId = tagIdMapping.get(lt.tagId);
        if (newTagId) {
          newLinkTags.push({ linkId: lt.linkId, tagId: newTagId });
        }
      }

      if (newLinkTags.length > 0) {
        await tx.insert(linkTag).values(newLinkTags);
      }

      result.linksTransferred = sourceLinks.length;
    }

    // Note: linkVisit and uniqueLinkVisit are NOT updated
    // They reference linkId, so analytics are preserved automatically

    // =========================================
    // Phase 4: Transfer QR Codes
    // =========================================
    const qrCodesUpdate = await tx
      .update(qrcode)
      .set({ userId: toUserId, teamId: null })
      .where(and(eq(qrcode.userId, fromUserId), isNull(qrcode.teamId)));

    result.qrCodesTransferred = qrCodesUpdate[0].affectedRows;

    // =========================================
    // Phase 5: Transfer QR Presets
    // =========================================
    const qrPresetsUpdate = await tx
      .update(qrPreset)
      .set({ userId: toUserId, teamId: null })
      .where(and(eq(qrPreset.userId, fromUserId), isNull(qrPreset.teamId)));

    result.qrPresetsTransferred = qrPresetsUpdate[0].affectedRows;

    // =========================================
    // Phase 6: Transfer Custom Domains
    // =========================================
    const domainsUpdate = await tx
      .update(customDomain)
      .set({ userId: toUserId, teamId: null })
      .where(and(eq(customDomain.userId, fromUserId), isNull(customDomain.teamId)));

    result.customDomainsTransferred = domainsUpdate[0].affectedRows;

    // =========================================
    // Phase 7: Transfer UTM Templates
    // =========================================
    const utmUpdate = await tx
      .update(utmTemplate)
      .set({ userId: toUserId, teamId: null })
      .where(and(eq(utmTemplate.userId, fromUserId), isNull(utmTemplate.teamId)));

    result.utmTemplatesTransferred = utmUpdate[0].affectedRows;

    // =========================================
    // Phase 8: Clean up source folders and tags
    // =========================================
    // Delete source folders (they've been recreated or merged)
    if (sourceFolders.length > 0) {
      await tx.delete(folder).where(
        and(eq(folder.userId, fromUserId), isNull(folder.teamId))
      );
    }

    // Delete source tags (they've been recreated or merged)
    if (sourceTags.length > 0) {
      await tx.delete(tag).where(
        and(eq(tag.userId, fromUserId), isNull(tag.teamId))
      );
    }

    // =========================================
    // Phase 10: Mark transfer as accepted
    // =========================================
    await tx
      .update(accountTransfer)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
        toUserId: toUserId,
      })
      .where(eq(accountTransfer.id, transferId));

    // =========================================
    // Phase 11: Soft-delete source account
    // =========================================
    await tx
      .update(user)
      .set({ deletedAt: new Date() })
      .where(eq(user.id, fromUserId));

    // Note: API tokens and subscriptions are NOT transferred
  });

  return result;
}

// ============================================================================
// CANCEL TRANSFER
// ============================================================================

export async function cancelAccountTransfer(
  ctx: ProtectedTRPCContext,
  input: CancelTransferInput
) {
  const transfer = await ctx.db.query.accountTransfer.findFirst({
    where: eq(accountTransfer.id, input.transferId),
  });

  if (!transfer) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Transfer not found",
    });
  }

  if (transfer.fromUserId !== ctx.auth.userId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the source account can cancel a transfer",
    });
  }

  if (transfer.status !== "pending") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Only pending transfers can be cancelled",
    });
  }

  await ctx.db
    .update(accountTransfer)
    .set({ status: "cancelled" })
    .where(eq(accountTransfer.id, input.transferId));

  return { success: true };
}

// ============================================================================
// RESTORE ACCOUNT (Cancel grace period deletion)
// ============================================================================

export async function restoreAccount(ctx: ProtectedTRPCContext) {
  const userRecord = await ctx.db.query.user.findFirst({
    where: eq(user.id, ctx.auth.userId),
  });

  if (!userRecord) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "User not found",
    });
  }

  if (userRecord.deletedAt === null) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Account is not marked for deletion",
    });
  }

  // Check if there's an accepted transfer (can only restore if resources still exist)
  const acceptedTransfer = await ctx.db.query.accountTransfer.findFirst({
    where: and(
      eq(accountTransfer.fromUserId, ctx.auth.userId),
      eq(accountTransfer.status, "accepted")
    ),
  });

  if (acceptedTransfer) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Cannot restore account. Transfer was completed and resources were moved to another account.",
    });
  }

  // Restore account
  await ctx.db
    .update(user)
    .set({ deletedAt: null })
    .where(eq(user.id, ctx.auth.userId));

  // Cancel any pending transfers
  await ctx.db
    .update(accountTransfer)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(accountTransfer.fromUserId, ctx.auth.userId),
        eq(accountTransfer.status, "pending")
      )
    );

  return { success: true };
}
