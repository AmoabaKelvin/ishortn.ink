import { describe, expect, test } from "bun:test";

import {
  buildEmbedSrc,
  EMBED_UNSUPPORTED_MESSAGE,
  embedFrameSize,
  oembedUrl,
  parseEmbedUrl,
} from "./embed";

function parsed(input: string) {
  const result = parseEmbedUrl(input);
  if (!result.ok) throw new Error(`expected ${input} to parse, got: ${result.error}`);
  return { ...result.embed, src: buildEmbedSrc(result.embed) };
}

function error(input: string) {
  const result = parseEmbedUrl(input);
  if (result.ok) throw new Error(`expected ${input} to be rejected`);
  return result.error;
}

describe("parseEmbedUrl: YouTube", () => {
  test.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL123",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ?si=abc",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://www.youtube.com/live/dQw4w9WgXcQ",
    "youtube.com/watch?v=dQw4w9WgXcQ",
  ])("%s", (input) => {
    expect(parsed(input)).toEqual({
      provider: "youtube",
      embedId: "dQw4w9WgXcQ",
      sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&playsinline=1&rel=0",
    });
  });

  test("rejects channel pages and malformed ids", () => {
    expect(error("https://www.youtube.com/@mkbhd")).toBe("Paste the link to a YouTube video.");
    expect(error("https://youtu.be/short")).toMatch(/isn't one we can embed/);
    expect(error('https://www.youtube.com/watch?v=dQw4w9WgXcQ"><script>')).toMatch(
      /isn't one we can embed/,
    );
  });
});

describe("parseEmbedUrl: Vimeo", () => {
  test("public, channel and player URLs", () => {
    expect(parsed("https://vimeo.com/76979871")).toMatchObject({
      embedId: "76979871",
      src: "https://player.vimeo.com/video/76979871?autoplay=1",
    });
    expect(parsed("https://vimeo.com/channels/staffpicks/76979871").embedId).toBe("76979871");
    expect(parsed("https://player.vimeo.com/video/76979871").embedId).toBe("76979871");
  });

  test("keeps the privacy hash of unlisted videos", () => {
    const fromPath = parsed("https://vimeo.com/76979871/0a1b2c3d4e");
    expect(fromPath).toMatchObject({
      embedId: "76979871/0a1b2c3d4e",
      sourceUrl: "https://vimeo.com/76979871/0a1b2c3d4e",
      src: "https://player.vimeo.com/video/76979871?autoplay=1&h=0a1b2c3d4e",
    });
    expect(parsed("https://player.vimeo.com/video/76979871?h=0a1b2c3d4e").embedId).toBe(
      "76979871/0a1b2c3d4e",
    );
  });

  test("rejects profiles and showcases", () => {
    expect(error("https://vimeo.com/staff")).toBe("Paste the link to a Vimeo video.");
    expect(error("https://vimeo.com/showcase/123456")).toMatch(/single Vimeo video/);
  });
});

describe("parseEmbedUrl: Spotify", () => {
  test.each([
    ["https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=x", "track/4cOdK2wGLETKBW3PvgPWqT"],
    [
      "https://open.spotify.com/intl-de/album/1DFixLWuPkv3KT3TnV35m3",
      "album/1DFixLWuPkv3KT3TnV35m3",
    ],
    [
      "https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M",
      "playlist/37i9dQZF1DXcBWIGoYBM5M",
    ],
    ["https://open.spotify.com/episode/512ojhOuo1ktJprKbVcKyQ", "episode/512ojhOuo1ktJprKbVcKyQ"],
  ])("%s", (input, embedId) => {
    expect(parsed(input)).toMatchObject({
      provider: "spotify",
      embedId,
      sourceUrl: `https://open.spotify.com/${embedId}`,
      src: `https://open.spotify.com/embed/${embedId}`,
    });
  });

  test("sizes the player by item type", () => {
    expect(
      embedFrameSize({ provider: "spotify", embedId: "track/4cOdK2wGLETKBW3PvgPWqT" }),
    ).toEqual({ height: 152 });
    expect(
      embedFrameSize({ provider: "spotify", embedId: "playlist/37i9dQZF1DXcBWIGoYBM5M" }),
    ).toEqual({ height: 352 });
  });

  test("rejects user pages", () => {
    expect(error("https://open.spotify.com/user/spotify")).toMatch(/isn't one we can embed/);
    expect(error("https://open.spotify.com/")).toMatch(/Spotify track/);
  });
});

describe("parseEmbedUrl: SoundCloud", () => {
  test("tracks and sets", () => {
    expect(parsed("https://soundcloud.com/forss/flickermood?in=x")).toMatchObject({
      embedId: "forss/flickermood",
      src: "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fforss%2Fflickermood&auto_play=true&visual=false",
    });
    expect(parsed("https://m.soundcloud.com/forss/sets/soulhack").embedId).toBe(
      "forss/sets/soulhack",
    );
  });

  test("rejects profiles and short links", () => {
    expect(error("https://soundcloud.com/forss")).toMatch(/SoundCloud track/);
    expect(error("https://on.soundcloud.com/abc123")).toMatch(/short link/);
  });
});

describe("parseEmbedUrl: TikTok", () => {
  test("video URLs", () => {
    expect(parsed("https://www.tiktok.com/@scout2015/video/6718335390845095173?lang=en")).toEqual({
      provider: "tiktok",
      embedId: "6718335390845095173",
      sourceUrl: "https://www.tiktok.com/@scout2015/video/6718335390845095173",
      src: "https://www.tiktok.com/player/v1/6718335390845095173?autoplay=1&rel=0",
    });
    expect(parsed("https://www.tiktok.com/embed/v2/6718335390845095173").embedId).toBe(
      "6718335390845095173",
    );
  });

  test("rejects profiles and short links", () => {
    expect(error("https://www.tiktok.com/@scout2015")).toBe("Paste the link to a TikTok video.");
    expect(error("https://vm.tiktok.com/ZMabc/")).toMatch(/short link/);
  });
});

describe("parseEmbedUrl: Google Maps", () => {
  test("place, search and query URLs become a search embed", () => {
    expect(
      parsed("https://www.google.com/maps/place/Eiffel+Tower/@48.8583701,2.2944813,17z/data=x"),
    ).toMatchObject({
      provider: "maps",
      embedId: "q:Eiffel Tower",
      src: "https://maps.google.com/maps?q=Eiffel%20Tower&output=embed",
    });
    expect(parsed("https://maps.google.com/?q=Accra+Mall").embedId).toBe("q:Accra Mall");
    expect(parsed("https://www.google.co.uk/maps/search/coffee+near+soho").embedId).toBe(
      "q:coffee near soho",
    );
    expect(parsed("https://www.google.com/maps/@5.6037,-0.1870,15z").embedId).toBe(
      "q:5.6037,-0.1870",
    );
  });

  test("the Share > Embed a map snippet keeps its pb parameter", () => {
    const snippet =
      '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3!2d-0.18!3d5.6!5e0!3m2!1sen" width="600" height="450" loading="lazy"></iframe>';
    expect(parsed(snippet)).toMatchObject({
      embedId: "pb:!1m18!1m12!1m3!1d3!2d-0.18!3d5.6!5e0!3m2!1sen",
      src: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3!2d-0.18!3d5.6!5e0!3m2!1sen",
    });
  });

  test("a real Embed a map snippet with a place id and name is accepted unchanged", () => {
    const pb =
      "!1m18!1m12!1m3!1d3022.2150523!2d-73.9878441!3d40.7484405!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89c259a9b3117469%3A0xd134e199a405a163!2sEmpire%20State%20Building!5e0!3m2!1sen!2sus!4v1700000000000!5m2!1sen!2sus";
    const snippet = `<iframe src="https://www.google.com/maps/embed?pb=${pb}" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
    expect(parsed(snippet)).toMatchObject({
      embedId: `pb:${pb}`,
      src: `https://www.google.com/maps/embed?pb=${pb}`,
    });
  });

  test("rejects other Google pages and short links", () => {
    expect(error("https://www.google.com/search?q=maps")).toBe("Paste a Google Maps link.");
    expect(error("https://maps.app.goo.gl/abc")).toMatch(/short link/);
  });
});

describe("parseEmbedUrl: everything else", () => {
  test("rejects other hosts, lookalikes and junk", () => {
    expect(error("https://example.com/video.mp4")).toBe(EMBED_UNSUPPORTED_MESSAGE);
    expect(error("https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ")).toBe(
      EMBED_UNSUPPORTED_MESSAGE,
    );
    expect(error("javascript:alert(1)")).toBe("That doesn't look like a valid URL.");
    expect(error("   ")).toBe("Paste the link you want to embed.");
    expect(error('<iframe src="https://evil.example/x"></iframe>')).toBe(EMBED_UNSUPPORTED_MESSAGE);
  });
});

describe("oEmbed", () => {
  test("oEmbed lookups exist for every provider but Maps", () => {
    expect(
      oembedUrl({ provider: "youtube", sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }),
    ).toBe(
      "https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ",
    );
    expect(oembedUrl({ provider: "maps", sourceUrl: "https://www.google.com/maps" })).toBeNull();
  });
});
