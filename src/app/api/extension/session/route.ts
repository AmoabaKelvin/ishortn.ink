import { and, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { token as tokenTable } from "@/server/db/schema";

import { EXTENSION_CORS_HEADERS, extensionPreflight, withExtensionToken } from "../auth";

export const OPTIONS = extensionPreflight;

/** Sign out: revokes the token the request was made with. */
export const DELETE = withExtensionToken(async (_request: Request, token) => {
  await db
    .delete(tokenTable)
    .where(and(eq(tokenTable.id, token.id), eq(tokenTable.kind, "extension")));
  return new Response(null, { status: 204, headers: EXTENSION_CORS_HEADERS });
});
