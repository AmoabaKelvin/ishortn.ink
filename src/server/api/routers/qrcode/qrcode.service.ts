import { eq } from "drizzle-orm";

import { link, qrcode, user } from "@/server/db/schema";

import type { ProtectedTRPCContext } from "../../trpc";
import type { QRCodeInput } from "./qrcode.input";
export const createQrCode = async (ctx: ProtectedTRPCContext, input: QRCodeInput) => {
  const userRecord = await ctx.db.query.user.findFirst({
    where: (table, { eq }) => eq(table.id, ctx.auth.userId),
    with: {
      subscriptions: true,
    },
  });
  const hasSubscription = userRecord?.subscriptions && userRecord.subscriptions.status === "active";

  // if the user has no subscription and they have 5 qr codes already, throw an error
  if (!hasSubscription && userRecord?.qrCodeCount && userRecord.qrCodeCount >= 5) {
    throw new Error(
      "You have reached the maximum number of QR Codes allowed. Please upgrade your subscription to create more QR Codes.",
    );
  }

  let linkId: number | null = null;

  if (input.wasShortened) {
    const popedAlias = input.content.split("/").pop();
    if (!popedAlias) throw new Error("Invalid alias");

    const link = await ctx.db.query.link.findFirst({
      where: (table, { eq }) => eq(table.alias, popedAlias),
    });

    if (!link) throw new Error("Link not found");

    linkId = link.id;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const insertionResult = await ctx.db.insert(qrcode).values({
    userId: ctx.auth.userId,
    title: input.title,
    color: input.selectedColor,
    content: input.content,
    cornerStyle: input.cornerStyle,
    patternStyle: input.patternStyle,
    qrCode: input.qrCodeBase64,
    linkId: linkId ?? 0,
    contentType: input.wasShortened ? "link" : "text",
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  } as any);

  const insertedQrCodeId = insertionResult[0].insertId;

  const insertedQrCode = await ctx.db.query.qrcode.findFirst({
    where: (table, { eq }) => eq(table.id, insertedQrCodeId),
  });

  // increment the qr code count for the user
  await ctx.db
    .update(user)
    .set({
      qrCodeCount: userRecord?.qrCodeCount ? userRecord.qrCodeCount + 1 : 1,
    })
    .where(eq(user.id, ctx.auth.userId));

  return insertedQrCode?.qrCode;
};

export async function retrieveUserQrCodes(ctx: ProtectedTRPCContext) {
  const qrCodes = await ctx.db.query.qrcode.findMany({
    where: (table, { eq }) => eq(table.userId, ctx.auth.userId),
    with: {
      link: {
        with: {
          linkVisits: true,
        },
      },
    },
  });

  // biome-ignore lint/complexity/noForEach: <explanation>
  qrCodes.forEach((qrCode) => {
    return { ...qrCode, numberOfVisits: qrCode.link?.linkVisits.length ?? 0 };
  });

  return qrCodes;
}

export async function deleteQrCode(ctx: ProtectedTRPCContext, id: number) {
  const qrCode = await ctx.db.query.qrcode.findFirst({
    where: (table, { eq }) => eq(table.id, id),
  });

  if (!qrCode) throw new Error("QR Code not found");

  if (qrCode.userId !== ctx.auth.userId) {
    throw new Error("You are not authorized to delete this QR Code");
  }

  if (qrCode.linkId) {
    await ctx.db.delete(link).where(eq(link.id, qrCode.linkId));
  }

  await ctx.db.delete(qrcode).where(eq(qrcode.id, id));

  return true;
}
