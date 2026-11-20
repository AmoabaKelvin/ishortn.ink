import { z } from "zod";

// The raw `ish_ft` cookie value; parsed and sanitised on the server.
export const recordAttributionInput = z.object({
  cookie: z.string().max(4096),
});

export type RecordAttributionInput = z.infer<typeof recordAttributionInput>;
