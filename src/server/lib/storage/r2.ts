import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { env } from "@/env.mjs";

import type { UploadImageParams } from "./types";

let client: S3Client | null = null;
let publicUrl: string | null = null;

function getClient(): S3Client | null {
  if (client) return client;

  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME,
    R2_PUBLIC_URL,
  } = env;

  if (
    !R2_ACCOUNT_ID ||
    !R2_ACCESS_KEY_ID ||
    !R2_SECRET_ACCESS_KEY ||
    !R2_BUCKET_NAME ||
    !R2_PUBLIC_URL
  ) {
    return null;
  }

  client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
  publicUrl = R2_PUBLIC_URL;

  return client;
}

export function isR2Configured(): boolean {
  return getClient() !== null;
}

export async function r2UploadImage(
  params: UploadImageParams
): Promise<string> {
  const s3Client = getClient();
  if (!s3Client || !publicUrl) {
    throw new Error("R2 storage not configured");
  }

  const key = generateKey(params);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME!,
      Key: key,
      Body: params.buffer,
      ContentType: params.contentType,
    })
  );

  return `${publicUrl}/${key}`;
}

export async function r2DeleteImage(key: string): Promise<void> {
  const s3Client = getClient();
  if (!s3Client) return;

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: env.R2_BUCKET_NAME!,
      Key: key,
    })
  );
}

function generateKey(params: UploadImageParams): string {
  const {
    workspaceId,
    workspaceType,
    imageType,
    resourceId,
    extension = "png",
  } = params;
  const prefix = workspaceType === "team" ? "teams" : "users";
  return `${prefix}/${workspaceId}/${imageType}/${resourceId}.${extension}`;
}

export function resetStorageProvider(): void {
  client = null;
  publicUrl = null;
}
