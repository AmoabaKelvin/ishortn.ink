import { TRPCError } from "@trpc/server";

import { env } from "@/env.mjs";
import { logger } from "@/lib/logger";
import type { WorkspaceTRPCContext } from "@/server/api/trpc";
import { type WorkspaceContext, workspaceOwnership } from "@/server/lib/workspace";

import { hasDeclaredImageFormat } from "./image-format";
import { normalizeImageOrientation } from "./image-orientation";
import { isR2Configured, r2DeleteImage, r2UploadImage } from "./r2";
import type { ImageType } from "./types";

const log = logger.child({ component: "image-upload" });

const MAX_SIZE_BYTES = 2 * 1024 * 1024;

const EXTENSION_MAP: Record<string, string> = {
  png: "png",
  jpeg: "jpg",
  gif: "gif",
  webp: "webp",
};

/**
 * True when `imageUrl` points at an object this workspace owns in our R2 bucket.
 * Stored image values are user-supplied strings, so anything that is not one of
 * our own keys must never be treated as a bucket object.
 */
export function isOwnedR2Url(workspace: WorkspaceContext, imageUrl: string): boolean {
  const publicUrl = env.R2_PUBLIC_URL;
  if (!publicUrl || !imageUrl.startsWith(`${publicUrl}/`)) return false;

  // Mirrors the key layout generateKey builds in ./r2.
  const ownership = workspaceOwnership(workspace);
  const prefix = ownership.teamId ? `teams/${ownership.teamId}/` : `users/${ownership.userId}/`;

  return imageUrl.slice(publicUrl.length + 1).startsWith(prefix);
}

interface UploadImageOptions {
  image: string;
  resourceId: number;
  imageType: ImageType;
}

export async function uploadImage(
  ctx: WorkspaceTRPCContext,
  { image, resourceId, imageType }: UploadImageOptions
): Promise<string | undefined> {
  if (!image) return undefined;
  if (image.startsWith("http")) return image;

  // Anything that is neither a URL nor a supported data URL is refused rather
  // than handed back: callers store the return value, so returning the input
  // here would persist bytes nothing has checked.
  const match = image.match(/^data:image\/(png|jpe?g|gif|webp);base64,(.+)$/);
  if (!match) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Unsupported image format." });
  }

  const [, rawFormat, base64Data] = match;
  const format = rawFormat === "jpg" ? "jpeg" : rawFormat!;
  const rawBuffer = Buffer.from(base64Data!, "base64");

  if (rawBuffer.length > MAX_SIZE_BYTES) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Image exceeds maximum size of 2MB." });
  }

  if (!hasDeclaredImageFormat(format, rawBuffer)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Image bytes do not match the declared ${format} type.`,
    });
  }

  if (!isR2Configured()) return image;

  try {
    // Bake in EXIF orientation so the OG image (rendered by next/og, which
    // ignores the tag) matches the upright way browsers show the avatar.
    const buffer = await normalizeImageOrientation(rawBuffer, format);

    const ownership = workspaceOwnership(ctx.workspace);

    return await r2UploadImage({
      buffer,
      contentType: `image/${format}`,
      imageType,
      workspaceId: ownership.teamId?.toString() ?? ownership.userId,
      resourceId: resourceId.toString(),
      workspaceType: ownership.teamId ? "team" : "personal",
      extension: EXTENSION_MAP[format] || "png",
    });
  } catch (error) {
    log.error({ err: error, imageType, resourceId }, "failed to upload image to R2");
    return image;
  }
}

/**
 * Deletes a stored image, but only when the URL names an object in the calling
 * workspace's own key prefix. Image fields hold user-supplied strings, so
 * without the scope check a user could point a link's metadata at another
 * tenant's public object URL and have this delete it.
 */
export async function deleteImage(
  workspace: WorkspaceContext,
  imageUrl: string
): Promise<void> {
  if (!isOwnedR2Url(workspace, imageUrl)) return;

  const key = imageUrl.slice(env.R2_PUBLIC_URL!.length + 1);
  if (key) await r2DeleteImage(key);
}
