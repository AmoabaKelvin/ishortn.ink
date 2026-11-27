import { encode } from "uqr";

// The canvas renderer needs a browser, so server code (the MCP create_qr_code tool) draws plain
// square modules into a 1-bit PNG instead. The image data is stored uncompressed (deflate
// "stored" blocks), which needs no zlib: a QR code at this scale is only a few kilobytes anyway.

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array) {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

const MAX_STORED_BLOCK = 0xffff;

/** zlib stream of `raw` in uncompressed deflate blocks. */
function zlibStored(raw: Uint8Array) {
  const blocks = Math.max(1, Math.ceil(raw.length / MAX_STORED_BLOCK));
  const out = new Uint8Array(2 + raw.length + blocks * 5 + 4);
  const view = new DataView(out.buffer);
  out[0] = 0x78;
  out[1] = 0x01;
  let offset = 2;
  for (let i = 0; i < blocks; i++) {
    const block = raw.subarray(i * MAX_STORED_BLOCK, (i + 1) * MAX_STORED_BLOCK);
    out[offset] = i === blocks - 1 ? 1 : 0;
    view.setUint16(offset + 1, block.length, true);
    view.setUint16(offset + 3, ~block.length & 0xffff, true);
    out.set(block, offset + 5);
    offset += 5 + block.length;
  }
  view.setUint32(offset, adler32(raw));
  return out;
}

/**
 * A black-on-white PNG of a QR code for `text`: `scale` pixels per module and a 4-module quiet
 * zone, at error correction level M like the dashboard's default.
 */
export function generateQRCodePng(text: string, { scale = 10 }: { scale?: number } = {}) {
  const { size, data } = encode(text, { ecc: "M", border: 4 });
  const width = size * scale;
  const rowBytes = Math.ceil(width / 8);

  // Palette entry 0 is white and 1 is black, so a dark module is a set bit.
  const raw = new Uint8Array((rowBytes + 1) * width);
  for (let y = 0; y < width; y++) {
    const row = data[Math.floor(y / scale)]!;
    const start = y * (rowBytes + 1) + 1; // the byte before is the row's filter type, 0 (none)
    for (let x = 0; x < width; x++) {
      if (row[Math.floor(x / scale)]) raw[start + (x >> 3)]! |= 0x80 >> (x & 7);
    }
  }

  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, width);
  headerView.setUint32(4, width);
  header[8] = 1; // bit depth
  header[9] = 3; // indexed colour

  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("PLTE", new Uint8Array([0xff, 0xff, 0xff, 0x00, 0x00, 0x00])),
    chunk("IDAT", zlibStored(raw)),
    chunk("IEND", new Uint8Array()),
  ];
  const png = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    png.set(part, offset);
    offset += part.length;
  }
  return png;
}
