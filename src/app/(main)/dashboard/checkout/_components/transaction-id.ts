import { z } from "zod";

// Paddle transaction ids are `txn_` followed by a lowercase alphanumeric id.
const transactionId = z.string().regex(/^txn_[a-z0-9]+$/);

/** The `_ptxn` query value when it is a single Paddle transaction id, otherwise null. */
export function parseTransactionId(value: string | string[] | undefined): string | null {
  const parsed = transactionId.safeParse(value);
  return parsed.success ? parsed.data : null;
}
