import { describe, expect, test } from "bun:test";

import {
  baseDomain,
  canonicalReferrer,
  formatReferrerLabel,
  groupReferrerChannels,
  groupReferrers,
  isEmailReferrer,
  isSearchReferrer,
  isSocialReferrer,
  referrerChannel,
} from "./referrer";
import { externalReferrer, parseReferrer } from "./visitor";

describe("baseDomain", () => {
  test("keeps three labels under two-part country suffixes", () => {
    expect(baseDomain("google.co.uk")).toBe("google.co.uk");
    expect(baseDomain("news.google.co.uk")).toBe("google.co.uk");
    expect(baseDomain("www.abc.com.au")).toBe("abc.com.au");
  });

  test("keeps two labels otherwise", () => {
    expect(baseDomain("news.ycombinator.com")).toBe("ycombinator.com");
    expect(baseDomain("bit.ly")).toBe("bit.ly");
    expect(baseDomain("blog.example.de")).toBe("example.de");
  });

  test("parseReferrer stores the registrable domain", () => {
    expect(parseReferrer("https://www.google.co.uk/search?q=x")).toBe("google.co.uk");
    expect(parseReferrer("https://t.co/abc")).toBe("twitter");
    expect(parseReferrer(null)).toBe("direct");
  });
});

describe("canonicalReferrer", () => {
  test("maps each platform's aliases to one source", () => {
    const cases = {
      facebook: ["facebook", "facebook.com", "m.facebook.com", "l.facebook.com", "fb.me"],
      x: ["twitter", "twitter.com", "x.com", "t.co", "mobile.twitter.com"],
      instagram: ["instagram", "instagram.com", "l.instagram.com"],
      linkedin: ["linkedin", "linkedin.com", "lnkd.in", "www.linkedin.com"],
      google: ["google", "google.com", "google.co.uk", "news.google.de"],
      youtube: ["youtube", "youtube.com", "m.youtube.com", "youtu.be"],
      reddit: ["reddit", "reddit.com", "out.reddit.com", "redd.it"],
      whatsapp: ["whatsapp", "whatsapp.com", "web.whatsapp.com", "wa.me", "com.whatsapp"],
      tiktok: ["tiktok", "tiktok.com", "vm.tiktok.com"],
      pinterest: ["pinterest", "pinterest.com", "pin.it"],
      threads: ["threads", "threads.net", "threads.com"],
      telegram: ["telegram", "t.me", "telegram.org"],
    };
    for (const [source, aliases] of Object.entries(cases)) {
      for (const alias of aliases) expect(canonicalReferrer(alias)).toBe(source);
    }
  });

  test("leaves other sources and domains unchanged", () => {
    expect(canonicalReferrer("direct")).toBe("direct");
    expect(canonicalReferrer("gmail")).toBe("gmail");
    expect(canonicalReferrer("news.ycombinator.com")).toBe("news.ycombinator.com");
    expect(canonicalReferrer("bing.com")).toBe("bing.com");
    expect(canonicalReferrer("googleusercontent.com")).toBe("googleusercontent.com");
  });

  test("display labels use the platform's name", () => {
    expect(formatReferrerLabel("x.com")).toBe("X");
    expect(formatReferrerLabel("youtube.com")).toBe("YouTube");
    expect(formatReferrerLabel("wa.me")).toBe("WhatsApp");
    expect(formatReferrerLabel("https://l.facebook.com/")).toBe("Facebook");
    expect(formatReferrerLabel("qr")).toBe("QR code scan");
    expect(formatReferrerLabel("tiktok.com")).toBe("TikTok");
    expect(formatReferrerLabel("wechat")).toBe("WeChat");
  });
});

describe("referrer classification", () => {
  test("stored source labels count as social", () => {
    for (const label of ["twitter", "facebook", "linkedin", "reddit", "x.com", "instagram.com"]) {
      expect(isSocialReferrer(label)).toBe(true);
    }
    expect(isSocialReferrer("direct")).toBe(false);
    expect(isSocialReferrer("google.com")).toBe(false);
  });

  test("search engines match across country domains", () => {
    expect(isSearchReferrer("google.com")).toBe(true);
    expect(isSearchReferrer("google.co.uk")).toBe(true);
    expect(isSearchReferrer("duckduckgo.com")).toBe(true);
    expect(isSearchReferrer("twitter")).toBe(false);
  });

  test("labels are title-cased; domains stay as stored", () => {
    expect(formatReferrerLabel("direct")).toBe("Direct");
    expect(formatReferrerLabel("null")).toBe("Direct");
    expect(formatReferrerLabel("linkedin")).toBe("LinkedIn");
    expect(formatReferrerLabel("twitter")).toBe("X");
    expect(formatReferrerLabel("google.co.uk")).toBe("Google");
    expect(formatReferrerLabel("bbc.co.uk")).toBe("bbc.co.uk");
    expect(formatReferrerLabel("https://www.example.com/page")).toBe("example.com");
  });

  test("groupReferrers merges legacy null with direct", () => {
    expect(groupReferrers({ null: 2, direct: 3, twitter: 1 })).toEqual([
      { source: "direct", name: "Direct", clicks: 5 },
      { source: "x", name: "X", clicks: 1 },
    ]);
  });

  test("groupReferrers gives one row per canonical source", () => {
    expect(
      groupReferrers({
        facebook: 2198,
        "facebook.com": 830,
        "https://l.facebook.com/l.php?u=x": 4,
        twitter: 10,
        "twitter.com": 5,
        "x.com": 3,
        "google.com": 7,
        "google.co.uk": 2,
      }),
    ).toEqual([
      { source: "facebook", name: "Facebook", clicks: 3032 },
      { source: "x", name: "X", clicks: 18 },
      { source: "google", name: "Google", clicks: 9 },
    ]);
  });

  test("canonical sources stay social or search", () => {
    expect(isSocialReferrer("x")).toBe(true);
    expect(isSocialReferrer("youtube.com")).toBe(true);
    expect(isSearchReferrer("google")).toBe(true);
    expect(isSearchReferrer("https://www.google.de/")).toBe(true);
  });
});

describe("referrerChannel", () => {
  test("groups sources into channels", () => {
    const cases = {
      social: ["instagram", "facebook", "x.com", "tiktok", "tiktok.com", "snapchat", "threads"],
      email: [
        "gmail",
        "list-manage.com",
        "mailchi.mp",
        "awstrack.me",
        "sendgrid.net",
        "outlook.com",
        "live.com",
        "office.com",
        "substack.com",
        "https://www.beehiiv.com/p/x",
      ],
      messaging: ["whatsapp", "wa.me", "telegram", "t.me", "wechat", "line"],
      search: ["google.com", "google.co.uk", "bing.com", "duckduckgo.com"],
      qr: ["qr"],
      website: ["ycombinator.com", "example.co.uk", "https://blog.example.com/post"],
      direct: ["direct", "null", "", "unknown"],
    };
    for (const [channel, sources] of Object.entries(cases)) {
      for (const source of sources) expect(referrerChannel(source)).toBe(channel);
    }
  });

  test("isEmailReferrer matches the email channel", () => {
    expect(isEmailReferrer("list-manage.com")).toBe(true);
    expect(isEmailReferrer("google.com")).toBe(false);
  });

  test("messaging apps and QR scans are not social", () => {
    expect(isSocialReferrer("whatsapp")).toBe(false);
    expect(isSocialReferrer("telegram")).toBe(false);
    expect(isSocialReferrer("qr")).toBe(false);
  });

  test("groupReferrerChannels gives one row per channel", () => {
    expect(
      groupReferrerChannels({
        direct: 5,
        null: 1,
        instagram: 3,
        "tiktok.com": 2,
        "list-manage.com": 4,
        qr: 6,
        "example.com": 1,
      }),
    ).toEqual([
      { source: "direct", name: "Direct", clicks: 6 },
      { source: "social", name: "Social", clicks: 5 },
      { source: "email", name: "Email", clicks: 4 },
      { source: "qr", name: "QR code scan", clicks: 6 },
      { source: "website", name: "Websites", clicks: 1 },
    ]);
  });
});

describe("externalReferrer", () => {
  test("drops empty referrers and the page's own host", () => {
    expect(externalReferrer(null, "ishortn.ink")).toBeNull();
    expect(externalReferrer("", "ishortn.ink")).toBeNull();
    expect(externalReferrer("https://ishortn.ink/p/me", "ishortn.ink")).toBeNull();
    expect(externalReferrer("https://www.Links.example.com/", "links.example.com:443")).toBeNull();
  });

  test("keeps other hosts, including unparseable values", () => {
    expect(externalReferrer("https://www.instagram.com/", "ishortn.ink")).toBe(
      "https://www.instagram.com/",
    );
    expect(externalReferrer("https://ishortn.ink/", "links.example.com")).toBe(
      "https://ishortn.ink/",
    );
    expect(externalReferrer("not a url", "ishortn.ink")).toBe("not a url");
    expect(externalReferrer("https://instagram.com/", null)).toBe("https://instagram.com/");
  });
});
