import { env } from "@/env.mjs";
import type { WorkspaceTRPCContext } from "@/server/api/trpc";
import { workspaceOwnership } from "@/server/lib/workspace";

import { isR2Configured, r2DeleteImage, r2UploadImage } from "./r2";
import type { ImageType } from "./types";

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
    const buffer = Buffer.from(base64Data!, "base64");

    if (buffer.length > MAX_SIZE_BYTES) {
      throw new Error("Image exceeds maximum size of 2MB");
    }

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
    console.error("Failed to upload image to R2:", error);
    return image;
  }
}

export async function deleteImage(imageUrl: string): Promise<void> {
  const publicUrl = env.R2_PUBLIC_URL;
  if (!publicUrl || !imageUrl.startsWith(publicUrl)) return;

  const key = imageUrl.slice(publicUrl.length + 1);
  if (key) await r2DeleteImage(key);
}
