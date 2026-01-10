export type ImageType = "og-image" | "qr-logo" | "qr-code";
export type WorkspaceType = "personal" | "team";

export interface UploadImageParams {
  buffer: Buffer;
  contentType: string;
  imageType: ImageType;
  workspaceId: string;
  resourceId: string;
  workspaceType: WorkspaceType;
  extension?: string;
}

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
}
