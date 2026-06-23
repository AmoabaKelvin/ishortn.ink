import sharp from "sharp";

/**
 * Bake EXIF orientation into the pixels and drop the tag.
 *
 * Phone photos carry an EXIF orientation tag (e.g. 3 = rotate 180°). Browsers
 * auto-apply it when rendering an <img>, but next/og (Satori) ignores it — so a
 * photo that looks upright on the page renders rotated/upside-down in the
 * generated OG image. Normalizing at upload time keeps both consistent.
 *
 * Orientation only meaningfully affects JPEG here, so other formats (and images
 * already upright) pass through untouched to avoid needless re-encoding. Falls
 * back to the original bytes if sharp can't process the input.
 */
export async function normalizeImageOrientation(buffer: Buffer, format: string): Promise<Buffer> {
  if (format !== "jpeg" && format !== "jpg") return buffer;
  try {
    const { orientation } = await sharp(buffer).metadata();
    if (!orientation || orientation === 1) return buffer; // already upright
    return await sharp(buffer).rotate().toBuffer(); // auto-orient + strip the tag
  } catch (error) {
    console.warn("failed to normalize image orientation; using original bytes", error);
    return buffer;
  }
}
