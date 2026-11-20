import { describe, expect, test } from "bun:test";

import { readLines } from "./feeds";
import {
  addLinkToIndex,
  capBlocks,
  createLinkIndex,
  decideMatch,
  type FeedKind,
  hostOfUrl,
  isSharedHost,
  matchFeedEntry,
  mergeDecisions,
  normalizeHost,
  normalizeUrl,
  parsePlainFeedLine,
  parseUrlhausCsvLine,
  type RescanDecision,
  type RescanSource,
  type ScanLink,
  selectSafeBrowsingUrls,
  withoutResolvedLinks,
} from "./utils";

const PLATFORM = ["isht.ink", "ishortn.ink"];

function indexOf(links: ScanLink[]) {
  const index = createLinkIndex(PLATFORM);
  for (const l of links) addLinkToIndex(index, l);
  return index;
}

function scan(links: ScanLink[], source: RescanSource, kind: FeedKind, feed: string) {
  const index = indexOf(links);
  const parse = source === "urlhaus" ? parseUrlhausCsvLine : parsePlainFeedLine;
  const decisions = feed
    .split("\n")
    .map(parse)
    .flatMap((entry) => (entry ? matchFeedEntry(index, source, kind, entry) : []))
    .map((m) => decideMatch(m, index.ownHosts));
  return mergeDecisions(decisions);
}

const link = (id: number, url: string, alias = `a${id}`, domain = "isht.ink"): ScanLink => ({
  id,
  url,
  alias,
  domain,
});

function streamOf(...chunks: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
}

describe("normalizeHost", () => {
  test("lowercases and strips www, port and trailing dot", () => {
    expect(normalizeHost("WWW.Example.COM.")).toBe("example.com");
    expect(normalizeHost("example.com:8080")).toBe("example.com");
  });

  test("rejects things that aren't hostnames", () => {
    expect(normalizeHost("localhost")).toBeNull();
    expect(normalizeHost("exa mple.com")).toBeNull();
    expect(normalizeHost("")).toBeNull();
  });
});

describe("hostOfUrl", () => {
  test("agrees with the URL parser on ordinary URLs", () => {
    for (const raw of [
      "https://dfgjs.weebly.com/",
      "http://user:pass@Evil.example.com:81/login?x=1",
      "evil.example.com/path",
      "https://www.a.com#frag",
    ]) {
      const parsed = new URL(raw.includes("://") ? raw : `http://${raw}`);
      expect(hostOfUrl(raw)).toBe(normalizeHost(parsed.hostname));
    }
  });
});

describe("normalizeUrl", () => {
  test("ignores scheme, www, trailing slash and fragment", () => {
    const key = "dfgjs.weebly.com";
    expect(normalizeUrl("https://dfgjs.weebly.com/")).toBe(key);
    expect(normalizeUrl("http://www.dfgjs.weebly.com")).toBe(key);
    expect(normalizeUrl("HTTPS://DFGJS.weebly.com/#top")).toBe(key);
  });

  test("keeps path case, query and non-default ports", () => {
    expect(normalizeUrl("https://a.com/Login/?next=/x")).toBe("a.com/Login?next=/x");
    expect(normalizeUrl("https://a.com:8443/x")).toBe("a.com:8443/x");
    expect(normalizeUrl("https://a.com:443/x")).toBe("a.com/x");
  });

  test("rejects non-web and unparseable URLs", () => {
    expect(normalizeUrl("ftp://188.128.111.33/view.html")).toBeNull();
    expect(normalizeUrl("mailto:a@b.com")).toBeNull();
    expect(normalizeUrl("   ")).toBeNull();
  });
});

describe("feed parsing", () => {
  test("plain feeds skip blanks and comments", () => {
    expect(parsePlainFeedLine("  https://evil.com/x \r")).toBe("https://evil.com/x");
    expect(parsePlainFeedLine("# comment")).toBeNull();
    expect(parsePlainFeedLine("! adblock comment")).toBeNull();
    expect(parsePlainFeedLine("")).toBeNull();
  });

  test("URLhaus CSV keeps only online rows and handles quoted commas", () => {
    const header = "# id,dateadded,url,url_status,last_online,threat,tags,urlhaus_link,reporter";
    const online =
      '"3600001","2026-11-20 10:00:00","http://evil.example/bin.sh","online","2026-11-20 10:00:00","malware_download","32-bit,elf,mips","https://urlhaus.abuse.ch/url/3600001/","anon"';
    const offline = online.replace('"online"', '"offline"').replace("bin.sh", "old.sh");
    expect(parseUrlhausCsvLine(header)).toBeNull();
    expect(parseUrlhausCsvLine(online)).toBe("http://evil.example/bin.sh");
    expect(parseUrlhausCsvLine(offline)).toBeNull();
  });

  test("readLines splits across chunk boundaries and keeps the last unterminated line", async () => {
    const lines: string[] = [];
    for await (const line of readLines(
      streamOf("https://a.co", "m/x\nhttps://b", ".com/y\nlast"),
    )) {
      lines.push(line);
    }
    expect(lines).toEqual(["https://a.com/x", "https://b.com/y", "last"]);
  });
});

describe("shared hosts", () => {
  const own = new Set(PLATFORM);

  test("platforms and their tenants are shared", () => {
    for (const host of [
      "weebly.com",
      "dfgjs.weebly.com",
      "foo.wixsite.com",
      "user.github.io",
      "x.blogspot.com",
      "x.blogspot.fi",
      "sites.google.com",
      "docs.google.com",
      "amazon.ie",
      "google.com.bo",
      "isht.ink",
    ]) {
      expect(isSharedHost(host, own)).toBe(true);
    }
  });

  test("ordinary domains and lookalikes are not", () => {
    for (const host of [
      "evil.example.com",
      "weebly.com.evil.io",
      "paypal-login.xyz",
      "notweebly.com",
    ]) {
      expect(isSharedHost(host, own)).toBe(false);
    }
  });
});

describe("block vs flag decisions", () => {
  test("fixture: an exact URL listing of https://dfgjs.weebly.com/ blocks the link", () => {
    const links = [link(1, "https://dfgjs.weebly.com/"), link(2, "https://legit.weebly.com/")];
    const feed =
      "# Phishing.Database ACTIVE links\nhttps://dfgjs.weebly.com\nhttps://other.example/x\n";
    const decisions = scan(links, "phishing-database-links", "url", feed);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({
      linkId: 1,
      action: "block",
      reason: "phishing-rescan: phishing-database-links",
    });
    expect(decisions[0]!.blockDomain).toBeUndefined();
  });

  test("a URL listing only matches the exact page", () => {
    const links = [link(1, "https://evil.example/login"), link(2, "https://evil.example/about")];
    const decisions = scan(links, "openphish", "url", "http://www.evil.example/login/");
    expect(decisions.map((d) => [d.linkId, d.action])).toEqual([[1, "block"]]);
  });

  test("a listed home page of a major or platform host only flags", () => {
    const links = [link(1, "https://notion.so/"), link(2, "https://weebly.com")];
    const feed = "https://notion.so\nhttps://www.weebly.com/";
    const decisions = scan(links, "phishing-database-links", "url", feed);
    expect(decisions.map((d) => [d.linkId, d.action])).toEqual([
      [1, "flag"],
      [2, "flag"],
    ]);
  });

  test("a domain listing on a shared host flags and never blocklists the host", () => {
    const links = [
      link(1, "https://dfgjs.weebly.com/page"),
      link(2, "https://docs.google.com/document/d/abc"),
    ];
    const decisions = scan(
      links,
      "phishing-database-domains",
      "domain",
      "dfgjs.weebly.com\ndocs.google.com",
    );
    expect(decisions.map((d) => [d.linkId, d.action, d.blockDomain])).toEqual([
      [1, "flag", undefined],
      [2, "flag", undefined],
    ]);
  });

  test("a domain listing on an ordinary host blocks and blocklists the exact host", () => {
    const links = [link(1, "https://login.evil.example/x"), link(2, "https://evil.example/")];
    const decisions = scan(links, "phishing-database-domains", "domain", "login.evil.example");
    expect(decisions).toEqual([
      expect.objectContaining({ linkId: 1, action: "block", blockDomain: "login.evil.example" }),
    ]);
  });

  test("a feed listing one of our short links blocks it, on any of our domains", () => {
    const links = [
      link(1, "https://evil.example/", "qsoi5tx8i", "ishortn.ink"),
      link(2, "https://fine.example/", "promo", "go.customer.com"),
      link(3, "https://fine.example/", "keep", "ishortn.ink"),
    ];
    const feed =
      "https://ishortn.ink/qSOI5TX8i\nhttps://go.customer.com/promo\nhttps://ishortn.ink/";
    const decisions = scan(links, "phishing-database-links", "url", feed);
    expect(decisions.map((d) => [d.linkId, d.action])).toEqual([
      [1, "block"],
      [2, "block"],
    ]);
  });

  test("a Safe Browsing threat blocks", () => {
    const decision = decideMatch(
      { linkId: 7, source: "safe-browsing", kind: "threat", entry: "SOCIAL_ENGINEERING", host: "" },
      new Set(PLATFORM),
    );
    expect(decision).toMatchObject({ action: "block", reason: "phishing-rescan: safe-browsing" });
  });

  test("a block from any source outranks a flag for the same link", () => {
    const flag: RescanDecision = {
      linkId: 1,
      action: "flag",
      source: "phishing-database-domains",
      reason: "phishing-rescan: phishing-database-domains",
      details: "",
    };
    const block: RescanDecision = { ...flag, action: "block", source: "openphish" };
    expect(mergeDecisions([flag, block])).toEqual([block]);
    expect(mergeDecisions([block, flag])).toEqual([block]);
  });
});

describe("withoutResolvedLinks", () => {
  const decision = (linkId: number, action: "block" | "flag"): RescanDecision => ({
    linkId,
    action,
    source: "openphish",
    reason: "phishing-rescan: openphish",
    details: "",
  });

  test("skips dismissed links and links an admin unblocked after a rescan block", () => {
    const result = withoutResolvedLinks(
      [decision(1, "block"), decision(2, "block"), decision(3, "block"), decision(4, "flag")],
      [
        { linkId: 1, status: "dismissed", reason: "user report" },
        { linkId: 2, status: "blocked", reason: "phishing-rescan: openphish" },
        { linkId: 3, status: "blocked", reason: "user report" },
      ],
    );
    expect(result.map((d) => d.linkId)).toEqual([3, 4]);
  });

  test("doesn't re-flag a pending rescan flag but lets it upgrade to a block", () => {
    const existing = [
      { linkId: 1, status: "pending" as const, reason: "phishing-rescan: openphish" },
    ];
    expect(withoutResolvedLinks([decision(1, "flag")], existing)).toEqual([]);
    expect(withoutResolvedLinks([decision(1, "block")], existing)).toHaveLength(1);
  });
});

describe("capBlocks", () => {
  test("turns blocks over the cap into flags without blocklisting", () => {
    const blocks: RescanDecision[] = [1, 2, 3].map((linkId) => ({
      linkId,
      action: "block",
      source: "phishing-database-domains",
      reason: "phishing-rescan: phishing-database-domains",
      details: "listed",
      blockDomain: `d${linkId}.example`,
    }));
    const capped = capBlocks(blocks, 2);
    expect(capped.map((d) => d.action)).toEqual(["block", "block", "flag"]);
    expect(capped[2]!.blockDomain).toBeUndefined();
  });
});

describe("selectSafeBrowsingUrls", () => {
  const candidates = [
    { id: 1, url: "https://a.com" },
    { id: 2, url: "https://b.com" },
    { id: 3, url: "https://a.com" },
    { id: 4, url: "https://c.com" },
    { id: 5, url: "https://d.com" },
  ];

  test("takes everything and resets the cursor when it fits", () => {
    const { urls, nextCursor } = selectSafeBrowsingUrls(candidates, 0, 10);
    expect([...urls.keys()]).toEqual([
      "https://a.com",
      "https://b.com",
      "https://c.com",
      "https://d.com",
    ]);
    expect(urls.get("https://a.com")).toEqual([1, 3]);
    expect(nextCursor).toBe(0);
  });

  test("resumes after the cursor and wraps around", () => {
    const first = selectSafeBrowsingUrls(candidates, 0, 2);
    expect([...first.urls.keys()]).toEqual(["https://a.com", "https://b.com"]);
    expect(first.nextCursor).toBe(3);

    const second = selectSafeBrowsingUrls(candidates, first.nextCursor, 3);
    expect([...second.urls.keys()]).toEqual(["https://c.com", "https://d.com", "https://a.com"]);
  });
});
