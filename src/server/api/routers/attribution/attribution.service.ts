import { eq } from "drizzle-orm";

import { parseFirstTouch } from "@/lib/attribution/parse-first-touch";
import { user, userAttribution } from "@/server/db/schema";

import type { ProtectedTRPCContext } from "../../trpc";
import type { RecordAttributionInput } from "./attribution.input";

// Only accounts created this recently are attributed, so an existing user who
// later lands on a campaign link and signs in is never credited to it.
export const SIGNUP_ATTRIBUTION_WINDOW_MS = 24 * 60 * 60 * 1000;

export type RecordAttributionResult = {
  recorded: boolean;
};

export const recordAttribution = async (
  ctx: ProtectedTRPCContext,
  input: RecordAttributionInput,
  now: Date = new Date(),
): Promise<RecordAttributionResult> => {
  const touch = parseFirstTouch(input.cookie, now);
  if (!touch) return { recorded: false };

  const userId = ctx.auth.userId;
  const [account, existing] = await Promise.all([
    ctx.db.query.user.findFirst({ where: eq(user.id, userId), columns: { createdAt: true } }),
    ctx.db.query.userAttribution.findFirst({
      where: eq(userAttribution.userId, userId),
      columns: { userId: true },
    }),
  ]);

  if (existing) return { recorded: false };
  const createdAt = account?.createdAt;
  if (!createdAt || now.getTime() - createdAt.getTime() > SIGNUP_ATTRIBUTION_WINDOW_MS) {
    return { recorded: false };
  }

  // IGNORE keeps a concurrent duplicate call (two tabs) from failing on the primary key.
  await ctx.db
    .insert(userAttribution)
    .ignore()
    .values({ userId, ...touch });

  return { recorded: true };
};
