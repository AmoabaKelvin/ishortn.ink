import { bioSlugSchema } from "@/server/api/routers/bio-page/bio-page.input";

import type { BioPageTheme } from "@/server/db/schema";
import type { RouterOutputs } from "@/trpc/shared";

type BioPageData = RouterOutputs["bioPage"]["get"];
type EditorBlock = BioPageData["blocks"][number];

export type BioSettingsDraft = {
  slug: string;
  title: string;
  description: string;
  avatarUrl: string | null;
  theme: BioPageTheme;
  removeBranding: boolean;
  customDomain: string;
  socialImageUrl: string | null;
};

export function toSettingsDraft(
  page: Pick<
    BioPageData,
    | "slug"
    | "title"
    | "description"
    | "avatarUrl"
    | "theme"
    | "removeBranding"
    | "customDomain"
    | "socialImageUrl"
  >,
): BioSettingsDraft {
  return {
    slug: page.slug,
    title: page.title ?? "",
    description: page.description ?? "",
    avatarUrl: page.avatarUrl ?? null,
    theme: page.theme ?? {},
    removeBranding: page.removeBranding ?? false,
    customDomain: page.customDomain ?? "",
    socialImageUrl: page.socialImageUrl ?? null,
  };
}

// Field-by-field so a theme rebuilt with a different key order (or with a key
// set back to undefined) still compares equal to the saved one.
function themeKey(t: BioPageTheme): string {
  const bg = t.background;
  return JSON.stringify([
    t.preset,
    t.accentColor,
    t.buttonStyle,
    t.font,
    bg?.type,
    bg?.color,
    bg?.from,
    bg?.to,
  ]);
}

export function isDraftDirty(draft: BioSettingsDraft, saved: BioSettingsDraft): boolean {
  return (
    draft.slug !== saved.slug ||
    draft.title !== saved.title ||
    draft.description !== saved.description ||
    draft.avatarUrl !== saved.avatarUrl ||
    draft.removeBranding !== saved.removeBranding ||
    draft.customDomain !== saved.customDomain ||
    draft.socialImageUrl !== saved.socialImageUrl ||
    themeKey(draft.theme) !== themeKey(saved.theme)
  );
}

// Same schema the server validates with, so the inline message matches the
// server's and an invalid handle never reaches the API.
export function getSlugError(slug: string): string | null {
  const result = bioSlugSchema.safeParse(slug);
  return result.success ? null : (result.error.issues[0]?.message ?? "Invalid handle");
}

type ErrorLike = {
  message: string;
  data?: {
    zodError?: { formErrors: string[]; fieldErrors: Record<string, string[] | undefined> } | null;
  } | null;
};

// tRPC puts the raw zod issue list in `message` for input errors; prefer the
// flattened, human-written messages the server attaches in `data.zodError`.
export function formatMutationError(error: ErrorLike): string {
  const zod = error.data?.zodError;
  if (zod) {
    const first = [...zod.formErrors, ...Object.values(zod.fieldErrors).flat()].find(Boolean);
    if (first) return first;
    return "Some fields are invalid. Check them and try again.";
  }
  return error.message;
}

// Mirrors the public page's visibility rules (isBlockLive and the blocked-link
// check in bio-page.service.ts) so the preview can flag blocks visitors won't see.
export function getBlockPreviewNote(
  block: Pick<EditorBlock, "type" | "isVisible" | "scheduledAt" | "scheduledUntil" | "blocked">,
  now: number,
): string | null {
  if (!block.isVisible) return "Hidden";
  if (
    (block.type === "link" || block.type === "whatsapp" || block.type === "image") &&
    block.blocked
  ) {
    return "Blocked, not shown";
  }
  if (block.scheduledAt && block.scheduledAt.getTime() > now) return "Scheduled";
  if (block.scheduledUntil && block.scheduledUntil.getTime() <= now) return "Ended";
  return null;
}

// Upgrade source for a plan rejection when adding or editing a block, from the
// gate named in the server's message.
export function bioBlockLimitSource(message: string): string {
  if (/schedul/i.test(message)) return "bio_scheduled_blocks";
  if (/embed/i.test(message)) return "bio_embed_block_limit";
  if (/image block/i.test(message)) return "bio_image_blocks";
  return "bio_link_block_limit";
}
