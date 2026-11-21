import { and, eq, exists, inArray, isNull, lt, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { emailSuppression, user } from "@/server/db/schema";

import { normalizeEmail, type SuppressionAction } from "./suppression-event";

import type { AnyMySqlColumn } from "drizzle-orm/mysql-core";

/**
 * SQL condition: the address in `emailColumn` has an active bounce or complaint. Built with the
 * query builder because a raw `sql` subquery in a single-table select list renders its columns
 * unqualified (`email = email`), which matches every row.
 */
export function isSuppressedSql(emailColumn: AnyMySqlColumn) {
  return exists(
    db
      .select({ id: emailSuppression.id })
      .from(emailSuppression)
      .where(and(eq(emailSuppression.email, emailColumn), isNull(emailSuppression.clearedAt))),
  );
}

export async function isEmailSuppressed(email: string): Promise<boolean> {
  const [row] = await db
    .select({ id: emailSuppression.id })
    .from(emailSuppression)
    .where(
      and(eq(emailSuppression.email, normalizeEmail(email)), isNull(emailSuppression.clearedAt)),
    )
    .limit(1);
  return !!row;
}

/** Whether the user's current address has an active hard bounce (drives the dashboard banner). */
export async function hasBouncedEmail(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: emailSuppression.id })
    .from(emailSuppression)
    .innerJoin(user, eq(user.email, emailSuppression.email))
    .where(
      and(
        eq(user.id, userId),
        eq(emailSuppression.type, "bounced"),
        isNull(emailSuppression.clearedAt),
      ),
    )
    .limit(1);
  return !!row;
}

export async function applySuppressionAction(action: SuppressionAction): Promise<void> {
  if (action.kind === "ignore") return;

  if (action.kind === "clear") {
    // Only a delivery that happened after the bounce proves the mailbox works again; complaints
    // stay until the recipient opts back in another way.
    await db
      .update(emailSuppression)
      .set({ clearedAt: action.at })
      .where(
        and(
          inArray(emailSuppression.email, action.emails),
          eq(emailSuppression.type, "bounced"),
          isNull(emailSuppression.clearedAt),
          lt(emailSuppression.lastEventAt, action.at),
        ),
      );
    return;
  }

  const owners = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(inArray(user.email, action.emails));
  const ownerOf = new Map(owners.map((owner) => [normalizeEmail(owner.email ?? ""), owner.id]));

  await db
    .insert(emailSuppression)
    .values(
      action.emails.map((email) => ({
        email,
        type: action.type,
        userId: ownerOf.get(email) ?? null,
        detail: action.detail,
        lastEventAt: action.at,
      })),
    )
    .onDuplicateKeyUpdate({
      set: {
        userId: sql`coalesce(values(${sql.identifier("userId")}), ${emailSuppression.userId})`,
        detail: sql`values(${sql.identifier("detail")})`,
        lastEventAt: sql`greatest(${emailSuppression.lastEventAt}, values(${sql.identifier("lastEventAt")}))`,
        // A bounce that predates the delivery which cleared the row arrived late; keep it cleared.
        clearedAt: sql`if(${emailSuppression.clearedAt} > values(${sql.identifier("lastEventAt")}), ${emailSuppression.clearedAt}, null)`,
      },
    });
}
