import { describe, expect, test } from "bun:test";

import { buildEmbedSrc } from "./embed";
import { parseEmbed, serializeEmbed } from "./embed-content";

describe("stored embed details", () => {
  test("round-trip through serialize/parse", () => {
    const details = { provider: "youtube" as const, embedId: "dQw4w9WgXcQ", title: "A song" };
    expect(parseEmbed(serializeEmbed(details))).toEqual(details);
    const untitled = serializeEmbed({ provider: "vimeo", embedId: "1234567" });
    expect(untitled).toBe('{"kind":"embed","provider":"vimeo","embedId":"1234567"}');
    expect(parseEmbed(untitled)).toEqual({ provider: "vimeo", embedId: "1234567" });
  });

  test("tampered or foreign content is rejected, so it never becomes a src", () => {
    expect(
      parseEmbed(JSON.stringify({ kind: "embed", provider: "youtube", embedId: "x/../../evil" })),
    ).toBeNull();
    expect(parseEmbed(JSON.stringify({ kind: "embed", provider: "iframe", embedId: "x" }))).toBe(
      null,
    );
    expect(parseEmbed("not json")).toBeNull();
    expect(parseEmbed(null)).toBeNull();
    expect(buildEmbedSrc({ provider: "maps", embedId: 'pb:"><script>' })).toBeNull();
  });
});
