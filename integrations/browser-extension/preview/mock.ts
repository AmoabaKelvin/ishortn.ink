// Dev-only: stands in for the extension APIs and the iShortn API so the real popup bundle can
// be rendered in a normal page. Select a scenario with ?state=<name>. Never shipped in dist.

type Scenario =
  | "not-connected"
  | "manual"
  | "creating"
  | "created"
  | "customize"
  | "limit"
  | "unshortenable"
  | "unshortenable-empty"
  | "network-error";

const params = new URLSearchParams(location.search);
const scenario = (params.get("state") ?? "created") as Scenario; // unknown values fall through to defaults below

const PAGE_URL = "https://www.example.com/blog/how-we-cut-our-page-load-time-in-half";
const BASE = "https://ishortn.ink";

const tabUrl = scenario.startsWith("unshortenable") ? "chrome://extensions/" : PAGE_URL;
const connected = scenario !== "not-connected";
const limitReached = scenario === "limit";

const localArea: Record<string, unknown> = connected ? { token: "preview-token" } : {};
if (["created", "creating", "customize", "limit"].includes(scenario)) localArea.autoShorten = true;
const sessionArea: Record<string, unknown> = {};

const area = (store: Record<string, unknown>) => ({
  get: async (key?: string | string[] | null) => {
    if (key === null || key === undefined) return { ...store };
    const keys = Array.isArray(key) ? key : [key];
    return Object.fromEntries(keys.filter((k) => k in store).map((k) => [k, store[k]]));
  },
  set: async (items: Record<string, unknown>) => {
    Object.assign(store, items);
  },
  remove: async (key: string | string[]) => {
    for (const k of Array.isArray(key) ? key : [key]) delete store[k];
  },
});

const log = (...args: unknown[]) => {
  // eslint-disable-next-line no-console -- preview harness diagnostics
  console.info("[preview]", ...args);
};

(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: {
    local: area(localArea),
    session: area(sessionArea),
    onChanged: { addListener: () => undefined },
  },
  tabs: {
    query: async () => [{ id: 1, url: tabUrl, active: true }],
    create: async (props: { url: string }) => log("tabs.create", props.url),
  },
  runtime: {
    sendMessage: async (message: unknown) => log("runtime.sendMessage", message),
    getPlatformInfo: async () => ({ os: "mac" }),
  },
  identity: { getRedirectURL: () => "https://preview.chromiumapp.org/" },
};

Object.defineProperty(navigator, "clipboard", {
  configurable: true,
  value: { writeText: async (text: string) => log("clipboard", text) },
});

const me = {
  email: "ada@example.com",
  plan: "free",
  linksUsedThisMonth: limitReached ? 30 : 12,
  linksLimit: 30,
  domains: [
    { domain: "ishortn.ink", isDefault: true },
    { domain: "go.acmestudio.com", isDefault: false },
  ],
  upgradeUrl: `${BASE}/dashboard/billing?utm_source=browser-extension`,
};

const recent =
  scenario === "unshortenable-empty"
    ? []
    : [
        { shortUrl: `${BASE}/q4Lx9`, url: PAGE_URL, createdAt: "2026-11-24T09:12:00Z" },
        { shortUrl: "https://go.acmestudio.com/launch", url: "https://www.acmestudio.com/news/2026/autumn-collection-launch-event?ref=newsletter", createdAt: "2026-11-23T16:40:00Z" },
        { shortUrl: `${BASE}/docs-api`, url: "https://docs.example.org/reference/api/v2/authentication", createdAt: "2026-11-22T11:05:00Z" },
        { shortUrl: `${BASE}/k8sTalk`, url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s", createdAt: "2026-11-20T08:30:00Z" },
        { shortUrl: `${BASE}/menu`, url: "https://cafe-luna.example/menu.pdf", createdAt: "2026-11-18T19:02:00Z" },
      ];

// Connected states open from the cached account, as every open after the first does. The
// network-error state has no cache so it shows the error screen of a first open.
if (connected && scenario !== "network-error") localArea.meCache = { me, savedAt: Date.now() };

let created = 0;

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input));
  const method = init?.method ?? "GET";
  log(method, url.pathname + url.search);
  if (scenario === "network-error") throw new TypeError("Failed to fetch");

  if (url.pathname === "/api/extension/me") {
    return Response.json({ ...me, linksUsedThisMonth: me.linksUsedThisMonth + created });
  }
  if (url.pathname === "/api/extension/links" && method === "POST") {
    if (scenario === "creating") return new Promise<Response>(() => undefined);
    if (limitReached) {
      return Response.json(
        { error: "You've used all 30 links included in Free this month.", upgradeUrl: me.upgradeUrl },
        { status: 403 },
      );
    }
    const body = JSON.parse(String(init?.body)) as { url: string; alias?: string; domain?: string }; // sent by the popup
    created += 1;
    const domain = body.domain ?? "ishortn.ink";
    const alias = body.alias ?? "q4Lx9";
    return Response.json(
      { shortUrl: `https://${domain}/${alias}`, alias, domain, url: body.url, createdAt: new Date().toISOString() },
      { status: 201 },
    );
  }
  if (url.pathname === "/api/extension/links") return Response.json({ links: recent });
  if (url.pathname === "/api/extension/session") return new Response(null, { status: 204 });
  return Response.json({ error: "Not found" }, { status: 404 });
};
