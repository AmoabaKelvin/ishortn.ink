import { env } from "@/env.mjs";
import { logger } from "@/lib/logger";
import type { WorkspaceTRPCContext } from "@/server/api/trpc";
import { workspaceOwnership } from "@/server/lib/workspace";

import { normalizeImageOrientation } from "./image-orientation";
import { isR2Configured, r2DeleteImage, r2UploadImage } from "./r2";
import type { ImageType } from "./types";

const log = logger.child({ component: "image-upload" });

const MAX_SIZE_BYTES = 2 * 1024 * 1024;

const EXTENSION_MAP: Record<string, string> = {
  png: "png",
  jpeg: "jpg",
  jpg: "jpg",
  gif: "gif",
  webp: "webp",
};

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

  const match = image.match(/^data:image\/(png|jpe?g|gif|webp);base64,(.+)$/);
  if (!match) return image;

  if (!isR2Configured()) return image;

  try {
    const [, format, base64Data] = match;
    const rawBuffer = Buffer.from(base64Data!, "base64");

    if (rawBuffer.length > MAX_SIZE_BYTES) {
      throw new Error("Image exceeds maximum size of 2MB");
    }

    // Bake in EXIF orientation so the OG image (rendered by next/og, which
    // ignores the tag) matches the upright way browsers show the avatar.
    const buffer = await normalizeImageOrientation(rawBuffer, format!);

    const ownership = workspaceOwnership(ctx.workspace);

    return await r2UploadImage({
      buffer,
      contentType: `image/${format}`,
      imageType,
      workspaceId: ownership.teamId?.toString() ?? ownership.userId,
      resourceId: resourceId.toString(),
      workspaceType: ownership.teamId ? "team" : "personal",
      extension: EXTENSION_MAP[format!] || "png",
    });
  } catch (error) {
    log.error({ err: error, imageType, resourceId }, "failed to upload image to R2");
    return image;
  }
}

export async function deleteImage(imageUrl: string): Promise<void> {
  const publicUrl = env.R2_PUBLIC_URL;
  if (!publicUrl || !imageUrl.startsWith(publicUrl)) return;

  const key = imageUrl.slice(publicUrl.length + 1);
  if (key) await r2DeleteImage(key);
}
