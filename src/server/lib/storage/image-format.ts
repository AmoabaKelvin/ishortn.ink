const MAGIC_BYTES: Record<string, (b: Buffer) => boolean> = {
  png: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  jpeg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9,
  gif: (b) => /^GIF8[79]a$/.test(b.subarray(0, 6).toString("latin1")),
  webp: (b) =>
    b.subarray(0, 4).toString("latin1") === "RIFF" &&
    b.subarray(8, 12).toString("latin1") === "WEBP",
};

/**
 * True when the bytes really are the format the data URI claimed.
 *
 * libvips picks its decoder from the bytes and ignores our label, so a
 * `data:image/jpeg` payload carrying, say, a crafted TIFF would otherwise reach
 * a decoder the upload path never intended to exercise.
 */
export function hasDeclaredImageFormat(format: string, buffer: Buffer): boolean {
  const check = MAGIC_BYTES[format];
  return !!check && buffer.length > 12 && check(buffer);
}
