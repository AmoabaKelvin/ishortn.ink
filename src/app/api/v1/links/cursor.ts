/** Position after the last link of a page in the `createdAt DESC, id DESC` listing. */
export type LinkCursor = { createdAt: Date | null; id: number };

export function encodeLinkCursor({ createdAt, id }: LinkCursor): string {
  return Buffer.from(`${createdAt?.getTime() ?? ""}:${id}`).toString("base64url");
}

/** Null for anything encodeLinkCursor couldn't have produced. */
export function decodeLinkCursor(cursor: string): LinkCursor | null {
  const match = /^(\d*):(\d+)$/.exec(Buffer.from(cursor, "base64url").toString());
  if (!match) return null;
  const [, createdAtMs = "", idText = ""] = match;
  const id = Number(idText);
  const ms = Number(createdAtMs);
  if (!Number.isSafeInteger(id)) return null;
  if (!createdAtMs) return { createdAt: null, id };
  const createdAt = new Date(ms);
  return Number.isNaN(createdAt.getTime()) ? null : { createdAt, id };
}
