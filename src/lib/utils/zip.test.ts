import { describe, expect, test } from "bun:test";

import { crc32, createZip } from "./zip";

// Reads an archive back through its central directory, the way unzip tools do.
function readZip(zip: Uint8Array) {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const decoder = new TextDecoder();
  const endOffset = zip.length - 22;
  expect(view.getUint32(endOffset, true)).toBe(0x06054b50);
  const count = view.getUint16(endOffset + 10, true);
  let position = view.getUint32(endOffset + 16, true);

  const files: { name: string; data: Uint8Array }[] = [];
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(position, true)).toBe(0x02014b50);
    const crc = view.getUint32(position + 16, true);
    const size = view.getUint32(position + 20, true);
    const nameLength = view.getUint16(position + 28, true);
    const localOffset = view.getUint32(position + 42, true);
    const name = decoder.decode(zip.subarray(position + 46, position + 46 + nameLength));

    expect(view.getUint32(localOffset, true)).toBe(0x04034b50);
    expect(view.getUint16(localOffset + 8, true)).toBe(0); // stored
    const localNameLength = view.getUint16(localOffset + 26, true);
    const start = localOffset + 30 + localNameLength;
    const data = zip.subarray(start, start + size);
    expect(crc32(data)).toBe(crc);

    files.push({ name, data });
    position += 46 + nameLength;
  }
  return files;
}

describe("crc32", () => {
  test("matches the standard check value", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
});

describe("createZip", () => {
  test("round-trips every entry with its name and bytes", () => {
    const encoder = new TextEncoder();
    const entries = [
      { name: "spring-sale.svg", data: encoder.encode("<svg/>") },
      { name: "spring-sale.png", data: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 255]) },
      { name: "café.svg", data: encoder.encode("é") },
    ];
    const files = readZip(createZip(entries));
    expect(files.map((file) => file.name)).toEqual(entries.map((entry) => entry.name));
    files.forEach((file, i) => expect([...file.data]).toEqual([...entries[i]!.data]));
  });

  test("an empty archive is just the end record", () => {
    const zip = createZip([]);
    expect(zip.length).toBe(22);
    expect(readZip(zip)).toEqual([]);
  });
});
