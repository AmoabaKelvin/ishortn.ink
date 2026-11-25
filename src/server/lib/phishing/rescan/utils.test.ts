import { describe, expect, test } from "bun:test";

import { readLines } from "./feeds";
import {
  addDestinationToIndex,
  addLinkToIndex,
  addSafeBrowsingCandidate,
  backlogDecisions,
  campaignPatternMatches,
  CAP_NOTE_LIKE,
  capBlocks,
  createLinkIndex,
  createSafeBrowsingWindow,
  decideMatch,
  distinctivePath,
  type FeedKind,
  flagPayingAccounts,
  hostOfUrl,
  indexBlockedPhishingPaths,
  isSharedHost,
  matchFeedEntry,
  mergeDecisions,
  normalizeHost,
  normalizeUrl,
  parsePlainFeedLine,
  parseUrlhausCsvLine,
  remainingBacklog,
  type RescanDecision,
  type RescanMatch,
  type RescanSource,
  type ExistingFlag,
  type ScanLink,
  selectSafeBrowsingUrls,
  shortLinkMatches,
  withoutResolvedLinks,
} from "./utils";

const PLATFORM = ["isht.app", "isht.ink", "ishortn.ink"];

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
    .concat(shortLinkMatches(index, links))
    .flatMap((m) => decideMatch(m, index.ownHosts) ?? []);
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
      "isht.app",
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

  test("a listed home page of a major or platform host is skipped", () => {
    const links = [
      link(1, "https://notion.so/"),
      link(2, "https://weebly.com"),
      link(3, "https://www.amazon.com/"),
    ];
    const feed = "https://notion.so\nhttps://www.weebly.com/\nhttps://amazon.com";
    expect(scan(links, "phishing-database-links", "url", feed)).toEqual([]);
  });

  test("a domain listing on a shared host is skipped and never blocklists the host", () => {
    const links = [
      link(1, "https://dfgjs.weebly.com/page"),
      link(2, "https://docs.google.com/document/d/abc"),
      link(3, "https://sites.google.com/view/shop"),
      link(4, "https://telegra.ph/Notice-11-20"),
      link(5, "https://bit.ly/3abc"),
      link(6, "https://pastebin.com/raw/xyz"),
    ];
    const feed =
      "dfgjs.weebly.com\ndocs.google.com\nsites.google.com\ntelegra.ph\nbit.ly\npastebin.com";
    expect(scan(links, "phishing-database-domains", "domain", feed)).toEqual([]);
  });

  test("an exact URL listing on a shared host still blocks, without blocklisting the host", () => {
    const links = [link(1, "https://telegra.ph/Login-11-20"), link(2, "https://telegra.ph/Ok")];
    const domains = scan(links, "phishing-database-domains", "domain", "telegra.ph");
    const urls = scan(links, "openphish", "url", "https://telegra.ph/Login-11-20");
    expect([...domains, ...urls].map((d) => [d.linkId, d.action, d.blockDomain])).toEqual([
      [1, "block", undefined],
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
      link(4, "https://evil.example/", "win", "isht.app"),
      link(5, "https://fine.example/", "win", "isht.ink"),
    ];
    const feed = [
      "https://ishortn.ink/qSOI5TX8i",
      "https://go.customer.com/promo",
      "https://ishortn.ink/",
      "https://isht.app/win",
    ].join("\n");
    const decisions = scan(links, "phishing-database-links", "url", feed);
    expect(decisions.map((d) => [d.linkId, d.action])).toEqual([
      [1, "block"],
      [2, "block"],
      [4, "block"],
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
  const decision = (
    linkId: number,
    action: "block" | "flag",
    source: RescanSource = "openphish",
    details = "Destination listed in feed: https://evil.example/login",
  ): RescanDecision => ({
    linkId,
    action,
    source,
    reason: `phishing-rescan: ${source}`,
    details,
  });
  const row = (
    id: number,
    d: RescanDecision,
    status: ExistingFlag["status"],
    overrides: Partial<ExistingFlag> = {},
  ): ExistingFlag => ({
    id,
    linkId: d.linkId,
    status,
    reason: d.reason,
    details: d.details,
    ...overrides,
  });

  test("skips the same evidence an admin dismissed or unblocked", () => {
    const dismissed = decision(1, "block");
    const unblocked = decision(2, "block");
    const result = withoutResolvedLinks(
      [dismissed, unblocked],
      [row(10, dismissed, "dismissed"), row(11, unblocked, "blocked")],
    );
    expect(result).toEqual([]);
  });

  test("a dismissed domain flag doesn't stop a later Safe Browsing threat from blocking", () => {
    const domainFlag = decision(
      1,
      "flag",
      "phishing-database-domains",
      "Destination host listed in feed, on a shared host: foo.weebly.com",
    );
    const threat = decision(
      1,
      "block",
      "safe-browsing",
      "Safe Browsing threat: https://foo.weebly.com/page (SOCIAL_ENGINEERING)",
    );
    const existing = [row(10, domainFlag, "dismissed")];
    expect(withoutResolvedLinks([domainFlag, threat], existing)).toEqual([threat]);
  });

  test("a feed re-listing the same URL with a trailing slash is the same evidence", () => {
    const block = decision(
      1,
      "block",
      "openphish",
      "Destination listed in feed: https://evil.example",
    );
    const dismissed = { ...block, details: "Destination listed in feed: http://www.evil.example/" };
    expect(withoutResolvedLinks([block], [row(10, dismissed, "dismissed")])).toEqual([]);
  });

  test("a changed destination is new evidence from the same source", () => {
    const before = decision(
      1,
      "block",
      "safe-browsing",
      "Safe Browsing threat: https://a.example (MALWARE)",
    );
    const after = decision(
      1,
      "block",
      "safe-browsing",
      "Safe Browsing threat: https://b.example (MALWARE)",
    );
    expect(withoutResolvedLinks([after], [row(10, before, "dismissed")])).toEqual([after]);
  });

  test("dismissed reports from outside the rescan never suppress it", () => {
    const block = decision(1, "block");
    const existing = [
      row(10, block, "dismissed", { reason: "user report", details: block.details }),
    ];
    expect(withoutResolvedLinks([block], existing)).toEqual([block]);
  });

  test("a dismissed over-the-cap flag covers the same block evidence", () => {
    const block = decision(1, "block");
    const capped = {
      ...block,
      details: `${block.details} (over the 250 auto-block limit for one run)`,
    };
    expect(withoutResolvedLinks([block], [row(10, capped, "dismissed")])).toEqual([]);
  });

  test("doesn't re-flag a pending rescan flag but resolves it with a block", () => {
    const flag = decision(1, "flag", "phishing-database-domains", "on a shared host");
    const existing = [row(10, flag, "pending")];
    expect(withoutResolvedLinks([flag], existing)).toEqual([]);
    const block = decision(1, "block");
    expect(withoutResolvedLinks([block], existing)).toEqual([{ ...block, resolvesFlagIds: [10] }]);
  });
});

describe("geo rule destinations", () => {
  test("a feed match on a rule destination maps to the link", () => {
    const index = indexOf([link(1, "https://safe.example/")]);
    addDestinationToIndex(index, 1, "https://dfgjs.weebly.com/");
    addDestinationToIndex(index, 1, "https://safe.example");
    const matches = matchFeedEntry(index, "openphish", "url", "https://dfgjs.weebly.com/");
    expect(matches.map((m) => [m.linkId, m.kind])).toEqual([[1, "url"]]);
    expect(index.byUrl.get("safe.example")).toBe(1);
    expect(decideMatch(matches[0]!, index.ownHosts)?.action).toBe("block");
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
    { id: 4, url: "https://e.com" },
    { id: 5, url: "https://d.com" },
  ];
  const select = (cursor: number, max: number) => {
    const window = createSafeBrowsingWindow(cursor, max);
    for (const c of candidates) addSafeBrowsingCandidate(window, c.id, c.url);
    return selectSafeBrowsingUrls(window);
  };

  test("takes everything and resets the cursor when it fits", () => {
    const { urls, nextCursor } = select(0, 10);
    expect([...urls.keys()]).toEqual([
      "https://a.com",
      "https://b.com",
      "https://c.com",
      "https://e.com",
      "https://d.com",
    ]);
    expect(urls.get("https://a.com")).toEqual([1, 3]);
    expect(nextCursor).toBe(0);
  });

  test("resumes after the cursor and wraps around", () => {
    const first = select(0, 2);
    expect([...first.urls.keys()]).toEqual(["https://a.com", "https://b.com"]);
    expect(first.nextCursor).toBe(2);

    const second = select(first.nextCursor, 4);
    expect([...second.urls.keys()]).toEqual([
      "https://a.com",
      "https://c.com",
      "https://e.com",
      "https://d.com",
    ]);
    expect(second.urls.get("https://a.com")).toEqual([3, 1]);
    expect(second.nextCursor).toBe(0);
  });

  test("keeps all of a link's URLs in one run and stops at the next link", () => {
    const { urls, nextCursor } = select(2, 2);
    expect([...urls.keys()]).toEqual(["https://a.com", "https://c.com", "https://e.com"]);
    expect(nextCursor).toBe(4);
  });

  test("wraps into the links before the cursor and stops there", () => {
    const { urls, nextCursor } = select(4, 3);
    expect([...urls.keys()]).toEqual(["https://d.com", "https://a.com", "https://b.com"]);
    expect(nextCursor).toBe(2);
  });
});

describe("backlog of blocks over the cap", () => {
  const CAP = 250;
  const ownHosts = new Set(PLATFORM);
  const threat = (linkId: number): RescanMatch => ({
    linkId,
    source: "safe-browsing",
    kind: "threat",
    entry: `https://evil${linkId}.example (SOCIAL_ENGINEERING)`,
    host: "",
  });
  const domainHit = (linkId: number): RescanMatch => ({
    linkId,
    source: "phishing-database-domains",
    kind: "domain",
    entry: `login${linkId}.evil.example`,
    host: `login${linkId}.evil.example`,
  });

  /** One run against an in-memory FlaggedLink table, applied the way `applyDecisions` does. */
  function run(
    flags: ExistingFlag[],
    blocked: Set<number>,
    matches: RescanMatch[],
    paying: ReadonlySet<number> = new Set(),
  ) {
    const queue = flags.filter(
      (f) =>
        f.status === "pending" &&
        f.reason?.startsWith("phishing-rescan:") &&
        f.details?.endsWith(CAP_NOTE_LIKE.slice(1)) &&
        !blocked.has(f.linkId),
    );
    const total = new Set(queue.map((f) => f.linkId)).size;
    const live = matches.filter((m) => !blocked.has(m.linkId));
    const fresh = mergeDecisions(
      withoutResolvedLinks(
        live.flatMap((m) => decideMatch(m, ownHosts) ?? []),
        flags.filter((f) => live.some((m) => m.linkId === f.linkId)),
      ),
    );
    const held = mergeDecisions([...backlogDecisions(queue.slice(0, CAP)), ...fresh]);
    const decisions = capBlocks(flagPayingAccounts(held, paying), CAP);

    const domains: string[] = [];
    for (const d of decisions) {
      const pending = flags.filter((f) => d.resolvesFlagIds?.includes(f.id));
      if (d.action === "block") {
        blocked.add(d.linkId);
        if (d.blockDomain) domains.push(d.blockDomain);
        for (const f of pending) Object.assign(f, { status: "blocked", details: d.details });
        if (!d.resolvesFlagIds) {
          flags.push({ id: flags.length + 1, linkId: d.linkId, status: "blocked", ...d });
        }
      } else if (!d.resolvesFlagIds) {
        flags.push({ id: flags.length + 1, linkId: d.linkId, status: "pending", ...d });
      } else if (d.relabel) {
        for (const f of pending) Object.assign(f, { reason: d.reason, details: d.details });
      }
    }
    const blocks = decisions.filter((d) => d.action === "block");
    return { blocked: blocks.length, domains, backlog: remainingBacklog(total, decisions) };
  }

  test("every match over the cap is blocked across consecutive runs", () => {
    const flags: ExistingFlag[] = [];
    const blocked = new Set<number>();
    const ids = Array.from({ length: 600 }, (_, i) => i + 1);
    const matches = ids.map((id) => (id % 2 ? threat(id) : domainHit(id)));

    // Safe Browsing only checks a link once per cycle, so later runs don't see these again.
    const first = run(flags, blocked, matches);
    expect(first).toMatchObject({ blocked: CAP, backlog: 350 });
    expect(flags.filter((f) => f.status === "pending")).toHaveLength(350);

    const second = run(flags, blocked, []);
    expect(second).toMatchObject({ blocked: CAP, backlog: 100 });
    // Domain blocklisting dropped by the cap comes back with the block.
    expect(second.domains).toContain(`login${CAP + 2}.evil.example`);

    const third = run(flags, blocked, []);
    expect(third).toMatchObject({ blocked: 100, backlog: 0 });

    expect([...blocked].sort((a, b) => a - b)).toEqual(ids);
    expect(flags.filter((f) => f.status === "pending")).toEqual([]);
    expect(new Set(flags.map((f) => f.linkId)).size).toBe(600);
    expect(run(flags, blocked, [])).toMatchObject({ blocked: 0, backlog: 0 });
  });

  test("the backlog goes before new matches, and re-matched links aren't counted twice", () => {
    const flags: ExistingFlag[] = [];
    const blocked = new Set<number>();
    run(
      flags,
      blocked,
      Array.from({ length: 300 }, (_, i) => threat(i + 1)),
    );

    // Links 251-300 wait; 251-260 match again alongside 220 new links.
    const again = Array.from({ length: 10 }, (_, i) => threat(251 + i));
    const fresh = Array.from({ length: 220 }, (_, i) => threat(1001 + i));
    const second = run(flags, blocked, [...again, ...fresh]);
    expect(second).toMatchObject({ blocked: CAP, backlog: 20 });
    for (let id = 251; id <= 300; id++) expect(blocked.has(id)).toBe(true);
    expect(blocked.has(1200)).toBe(true);
    expect(blocked.has(1201)).toBe(false);

    expect(run(flags, blocked, [])).toMatchObject({ blocked: 20, backlog: 0 });
  });

  test("a capped block on a link with another pending rescan flag joins the backlog", () => {
    const flags: ExistingFlag[] = [
      {
        id: 1,
        linkId: 999,
        status: "pending",
        reason: "phishing-rescan: phishing-database-domains",
        details: "Destination host listed in feed, on a shared host: x.weebly.com",
      },
    ];
    const blocked = new Set<number>();
    const matches = [...Array.from({ length: CAP }, (_, i) => threat(i + 1)), threat(999)];
    expect(run(flags, blocked, matches)).toMatchObject({ blocked: CAP, backlog: 1 });
    expect(flags[0]!.reason).toBe("phishing-rescan: safe-browsing");
    expect(run(flags, blocked, [])).toMatchObject({ blocked: 1, backlog: 0 });
    expect(flags[0]!.status).toBe("blocked");
  });

  test("paying accounts are flagged instead, don't use the cap and leave the backlog", () => {
    const flags: ExistingFlag[] = [];
    const blocked = new Set<number>();
    const paying = new Set([2, 301]);
    const first = run(
      flags,
      blocked,
      Array.from({ length: 301 }, (_, i) => threat(i + 1)),
      new Set([2]),
    );
    expect(first).toMatchObject({ blocked: CAP, backlog: 50 });
    expect(blocked.has(2)).toBe(false);
    expect(flags.find((f) => f.linkId === 2)?.details).toEndWith(
      "(paying account, review before blocking)",
    );

    // Link 301 became a paying account while it waited.
    expect(run(flags, blocked, [], paying)).toMatchObject({ blocked: 49, backlog: 0 });
    expect(blocked.has(301)).toBe(false);
    const waiting = flags.find((f) => f.linkId === 301);
    expect(waiting?.status).toBe("pending");
    expect(waiting?.details).toEndWith("(paying account, review before blocking)");
    expect(run(flags, blocked, [], paying)).toMatchObject({ blocked: 0, backlog: 0 });
  });

  test("an admin dismissing a paying-account flag covers the same evidence later", () => {
    const [flag] = flagPayingAccounts([decideMatch(threat(1), ownHosts)!], new Set([1]));
    const dismissed: ExistingFlag = { id: 1, linkId: 1, status: "dismissed", ...flag! };
    expect(withoutResolvedLinks([decideMatch(threat(1), ownHosts)!], [dismissed])).toEqual([]);
  });
});

describe("campaign patterns", () => {
  const KIT_PATH =
    "wp-includes-old/ratingdocumentsdocumtesdcopycodesprojectinnobb/richdocumentationandpresentationsofliddy";
  const ownHosts = new Set(["ishortn.ink", "isht.ink"]);
  const blockedPaths = indexBlockedPhishingPaths(
    [`https://first-compromised.example/${KIT_PATH}/`],
    ownHosts,
  );

  test("a distinctive path is the trimmed, lowercased path", () => {
    expect(
      distinctivePath(
        "https://blocked.example/wp-includes-old/RatingDocumentsDocumtesdCopycodesProjectInnobb/richdocumentationandpresentationsofliddy/",
      ),
    ).toBe(KIT_PATH);
  });

  test("short and common paths are not distinctive", () => {
    for (const url of [
      "https://example.com/",
      "https://example.com/login",
      "https://example.com/index.html",
      "https://example.com/blog/post",
      "https://example.com/wp-admin/admin-ajax.php?action=some-long-action-name",
      "https://example.com/wp-admin/options-general-and-more-settings.php",
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=x",
      "not a url",
    ]) {
      expect(distinctivePath(url)).toBeNull();
    }
  });

  test("the same distinctive path on a different host matches a blocked phishing link", () => {
    const url = `https://compromised-site.example/${KIT_PATH}/?id=1`;
    expect(campaignPatternMatches(7, url, blockedPaths, ownHosts)).toEqual([
      { linkId: 7, source: "campaign-pattern", kind: "campaign-path", entry: url, host: "" },
    ]);
  });

  test("the blocked URL re-shortened on its own host matches", () => {
    const url = `https://www.first-compromised.example/${KIT_PATH}?id=2`;
    expect(campaignPatternMatches(7, url, blockedPaths, ownHosts)).toEqual([
      { linkId: 7, source: "campaign-pattern", kind: "campaign-path", entry: url, host: "" },
    ]);
  });

  test("paths of blocked links on major or shared hosts never become triggers", () => {
    const consent =
      "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?client_id=evil";
    const paths = indexBlockedPhishingPaths(
      [
        consent,
        "https://www.paypal.com/myaccount/transfer/homepage?evil=1",
        "https://evil.github.io/some-long-tenant-path/sign-in-page",
      ],
      ownHosts,
    );
    expect(paths.size).toBe(0);
  });

  test("a legitimate link on a major host never matches a blocked kit's copied path", () => {
    const paths = indexBlockedPhishingPaths(
      ["https://paypa1.example/myaccount/transfer/homepage"],
      ownHosts,
    );
    expect(paths.has("myaccount/transfer/homepage")).toBe(true);
    for (const url of [
      "https://www.paypal.com/myaccount/transfer/homepage",
      "https://paypal.co.uk/myaccount/transfer/homepage",
    ]) {
      expect(campaignPatternMatches(7, url, paths, ownHosts)).toEqual([]);
    }
    expect(
      campaignPatternMatches(
        7,
        "https://other-kit.example/myaccount/transfer/homepage",
        paths,
        ownHosts,
      ),
    ).toHaveLength(1);
  });

  test("other paths and normal links don't match", () => {
    for (const url of [
      "https://example.com/blog/post",
      "https://example.com/login",
      "https://example.com/",
      `https://example.com/${KIT_PATH}-v2`,
    ]) {
      expect(campaignPatternMatches(7, url, blockedPaths, ownHosts)).toEqual([]);
    }
  });

  test("an email in an open redirect's fragment or query matches", () => {
    for (const url of [
      "https://www.google.com/url?q=https://evil.example/doc&sa=D#x=jane@acme.com",
      "https://google.co.uk/url?q=https%3A%2F%2Fevil.example%2F%3Fe%3Djane%2540acme.com",
      "https://www.bing.com/ck/a?u=a1aHR0cHM6Ly9ldmlsLmV4YW1wbGU&e=jane@acme.com",
    ]) {
      expect(campaignPatternMatches(7, url, new Set(), ownHosts)).toEqual([
        { linkId: 7, source: "campaign-pattern", kind: "email-redirect", entry: url, host: "" },
      ]);
    }
  });

  test("a redirect without an email, or an email outside a redirector, doesn't match", () => {
    for (const url of [
      "https://www.google.com/url?q=https://example.com/page&sa=D",
      "https://www.google.com/search?q=jane@acme.com",
      "https://example.com/contact?email=jane@acme.com",
      "https://notgoogle.com/url?q=x#jane@acme.com",
      // Email-shaped tokens and URLs that only contain an `@`.
      "https://www.google.com/url?q=https://example.com/&redir_token=x@y.co",
      "https://www.google.com/url?q=https%3A%2F%2Fuser%3Apass%40host.co%2Fpage",
      "https://www.youtube.com/redirect?q=https://medium.com/@writer/a-post&v=1",
      "https://www.google.com/url?q=https://example.com/&sig=ab12@cd34",
    ]) {
      expect(campaignPatternMatches(7, url, new Set(), ownHosts)).toEqual([]);
    }
  });

  test("matches block like other URL-level evidence, and paying accounts are flagged", () => {
    const url = `https://compromised-site.example/${KIT_PATH}`;
    const [match] = campaignPatternMatches(7, url, blockedPaths, ownHosts);
    const decision = decideMatch(match!, new Set())!;
    expect(decision).toMatchObject({
      action: "block",
      reason: "phishing-rescan: campaign-pattern",
      details: `Same path as a link blocked for phishing: ${url}`,
    });
    expect(flagPayingAccounts([decision], new Set([7]))[0]?.action).toBe("flag");
    // A held-back block of this source comes back from the backlog.
    expect(
      backlogDecisions([{ id: 1, linkId: 7, reason: decision.reason, details: decision.details }]),
    ).toHaveLength(1);
  });
});
