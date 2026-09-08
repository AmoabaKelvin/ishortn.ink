import { decode, encode } from "@jsquash/jpeg";
import exifr from "exifr";

import type sharp from "sharp";

const ENCODE_QUALITY = 85;

// sharp is a native module and only exists on Node; on Cloudflare Workers we
// fall back to the pure WASM/JS path below. The specifier is hidden inside
// Function so neither Turbopack nor the OpenNext esbuild pass resolves it:
// OpenNext excludes sharp from the Worker bundle, so a statically analyzable
// import("sharp") fails the `opennextjs-cloudflare build` step. In workerd,
// `new Function` itself throws (no code generation from strings) and lands in
// the catch, which is the fallback we want.
async function loadSharp(): Promise<typeof sharp | undefined> {
  try {
    // SAFETY: the Function body is exactly `import(s)`; hiding the specifier
    // only affects bundling, not the namespace "sharp" resolves to. A stubbed
    // module (the test's Workers path) has no default export, hence optional.
    const dynamicImport = new Function("s", "return import(s)") as (
      s: "sharp",
    ) => Promise<{ default?: typeof sharp }>;
    const mod = await dynamicImport("sharp");
    return mod.default;
  } catch {
    return undefined;
  }
}

// dest(x, y) -> src(sx, sy) for each EXIF orientation; 5-8 swap width/height.
function applyOrientation(image: ImageData, orientation: number): ImageData {
  const { data, width, height } = image;
  const swap = orientation >= 5;
  const outWidth = swap ? height : width;
  const outHeight = swap ? width : height;
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < outHeight; y++) {
    for (let x = 0; x < outWidth; x++) {
      let sx: number;
      let sy: number;
      switch (orientation) {
        case 2: // mirror horizontal
          sx = width - 1 - x;
          sy = y;
          break;
        case 3: // rotate 180
          sx = width - 1 - x;
          sy = height - 1 - y;
          break;
        case 4: // mirror vertical
          sx = x;
          sy = height - 1 - y;
          break;
        case 5: // transpose
          sx = y;
          sy = x;
          break;
        case 6: // rotate 90 CW
          sx = y;
          sy = height - 1 - x;
          break;
        case 7: // transverse
          sx = width - 1 - y;
          sy = height - 1 - x;
          break;
        default: // 8: rotate 270 CW
          sx = width - 1 - y;
          sy = x;
          break;
      }
      const src = (sy * width + sx) * 4;
      const dst = (y * outWidth + x) * 4;
      out[dst] = data[src]!;
      out[dst + 1] = data[src + 1]!;
      out[dst + 2] = data[src + 2]!;
      out[dst + 3] = data[src + 3]!;
    }
  }
  return { data: out, width: outWidth, height: outHeight, colorSpace: "srgb" };
}

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
 * back to the original bytes if the input can't be processed. Uses sharp when
 * available (Node), otherwise exifr + @jsquash/jpeg (WASM) so it can run
 * on Cloudflare Workers too.
 */
export async function normalizeImageOrientation(buffer: Buffer, format: string): Promise<Buffer> {
  if (format !== "jpeg" && format !== "jpg") return buffer;
  try {
    const orientation = await exifr.orientation(buffer);
    if (!orientation || orientation === 1) return buffer; // already upright
    // Nonstandard tag values would hit applyOrientation's default (8) branch
    if (!Number.isInteger(orientation) || orientation < 2 || orientation > 8) return buffer;

    const sharp = await loadSharp();
    if (sharp) return await sharp(buffer).rotate().toBuffer(); // auto-orient + strip the tag

    const bytes = new Uint8Array(buffer).buffer;
    const upright = applyOrientation(await decode(bytes), orientation);
    return Buffer.from(await encode(upright, { quality: ENCODE_QUALITY }));
  } catch (error) {
    console.warn("failed to normalize image orientation; using original bytes", error);
    return buffer;
  }
}
