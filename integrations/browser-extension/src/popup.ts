import { type Api, ApiError, type CreatedLink, type Me, type RecentLink, createApi } from "./lib/api.ts";
import { ext } from "./lib/browser.ts";
import { BASE_URL, urls } from "./lib/config.ts";
import { h, icon } from "./lib/dom.ts";
import { type UiError, mapApiError } from "./lib/errors.ts";
import { planName, qrFileName, usageText } from "./lib/format.ts";
import { type CachedLink, lookupCachedLink, withCachedLink } from "./lib/link-cache.ts";
import { meCache, shouldAutoShorten } from "./lib/me-cache.ts";
import { drawQr, qrPngDataUrl } from "./lib/qr.ts";
import { displayUrl, isShortenableUrl, normalizePastedUrl } from "./lib/shortenable.ts";
import { local, session } from "./lib/storage.ts";

const app = document.getElementById("app") as HTMLElement; // present in popup.html
const live = document.getElementById("live") as HTMLElement; // present in popup.html
const planBadge = document.getElementById("plan") as HTMLElement; // present in popup.html

const QR_SIZE = 140;
const CONNECT_STATUS_TTL_MS = 5 * 60 * 1000;
const SIGN_OUT_TIMEOUT_MS = 3000;

let tabUrl: string | null = null;
// Each view bumps this so async work started by an older view can't render over a newer one.
let generation = 0;

type Ctx = { api: Api; me: Me; gen: number };
type ShownLink = Pick<CreatedLink, "shortUrl" | "alias" | "domain"> & { url: string };

// ---------------------------------------------------------------------------
// Platform helpers

const activeTabUrl = async (): Promise<string | null> => {
  try {
    const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
    return tab?.url ?? null;
  } catch {
    return null;
  }
};

const openTab = (url: string) => {
  void ext.tabs.create({ url }).finally(() => window.close());
};

const announce = (message: string) => {
  live.textContent = "";
  window.setTimeout(() => {
    live.textContent = message;
  }, 50);
};

const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Without a recent user gesture some browsers refuse the async API; try the legacy path.
  }
  const area = h("textarea", { class: "sr-only", "aria-hidden": "true", readonly: true });
  area.value = text;
  const previous = document.activeElement;
  document.body.append(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  if (previous instanceof HTMLElement) previous.focus();
  return ok;
};

const downloadQr = async (text: string) => {
  const anchor = h("a", { href: await qrPngDataUrl(text), download: qrFileName(text) });
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
};

const mount = (view: string, ...nodes: Array<Node | null | false>) => {
  app.replaceChildren(...nodes.filter((node): node is Node => Boolean(node)));
  app.dataset.view = view;
  app.setAttribute("aria-busy", "false");
};

const setPlan = (me: Me | null) => {
  planBadge.hidden = !me;
  planBadge.textContent = me ? planName(me.plan) : "";
};

// ---------------------------------------------------------------------------
// Building blocks

const button = (
  label: string,
  onClick: () => void,
  options: { primary?: boolean; block?: boolean; large?: boolean; iconName?: Parameters<typeof icon>[0] } = {},
) => {
  const classes = ["btn"];
  if (options.primary) classes.push("btn-primary");
  if (options.block) classes.push("btn-block");
  if (options.large) classes.push("btn-lg");
  return h(
    "button",
    { type: "button", class: classes.join(" "), onClick: () => onClick() },
    options.iconName ? icon(options.iconName, 14, options.primary ? 2 : 1.75) : null,
    h("span", {}, label),
  );
};

const setButtonLabel = (btn: HTMLButtonElement, label: string) => {
  const span = btn.querySelector("span");
  if (span) span.textContent = label;
};

const flashButton = (btn: HTMLButtonElement, label: string) => {
  const original = btn.querySelector("span")?.textContent ?? "";
  setButtonLabel(btn, label);
  window.setTimeout(() => setButtonLabel(btn, original), 1500);
};

/** QR card: the code on a white tile with a side column for context and actions. */
const qrCard = async (text: string, side: Node[]) => {
  const canvas = h("canvas", { role: "img", "aria-label": `QR code for ${displayUrl(text)}` });
  await drawQr(canvas, text, QR_SIZE);
  return h("div", { class: "qr-card" }, h("div", { class: "qr-tile" }, canvas), h("div", { class: "qr-side" }, ...side));
};

const qrActions = (text: string, copyLabel: string) => {
  const copyBtn = button(copyLabel, () => {
    void copyText(text).then((ok) => {
      if (ok) {
        flashButton(copyBtn, "Copied");
        announce("Copied");
      } else {
        announce("Couldn't copy. Select the text and copy it manually.");
      }
    });
  }, { iconName: "copy" });
  const downloadBtn = button("Download PNG", () => void downloadQr(text), { iconName: "download" });
  return h("div", { class: "stack" }, downloadBtn, copyBtn);
};

const note = (message: string, iconName: "info" | "alert" = "info") =>
  h("div", { class: "note" }, icon(iconName, 14), h("span", {}, message));

const alertBox = (error: UiError, action: HTMLButtonElement | null) =>
  h(
    "div",
    { class: "alert", role: "alert" },
    h("p", { class: "alert-message" }, icon("alert", 14), h("span", {}, error.message)),
    action,
  );

const errorAction = (error: UiError, retry: (() => void) | null): HTMLButtonElement | null => {
  if (error.kind === "upgrade" && error.upgradeUrl) {
    const url = error.upgradeUrl;
    return button("Upgrade", () => openTab(url), { primary: true, iconName: "arrowUpRight" });
  }
  if (error.kind === "retry" && retry) return button("Retry", retry, { iconName: "refresh" });
  return null;
};

const autoShortenSwitch = (checked: boolean) => {
  const input = h("input", {
    type: "checkbox",
    role: "switch",
    id: "auto-shorten",
    checked,
    onChange: (event) => {
      const target = event.currentTarget;
      if (target instanceof HTMLInputElement) void local.set("autoShorten", target.checked);
    },
  });
  return h("label", { class: "switch", for: "auto-shorten" }, h("span", {}, "Shorten automatically when I open the popup"), input);
};

const footer = (ctx: Ctx | null) => {
  const links = h(
    "div",
    { class: "footer-links" },
    h("button", { type: "button", class: "link link-muted", onClick: () => openTab(urls.dashboard()) }, "Dashboard"),
    h("button", { type: "button", class: "link link-muted", onClick: () => openTab(urls.settings()) }, "Settings"),
    h("button", { type: "button", class: "link link-muted push", onClick: () => void signOut(ctx?.api ?? null) }, "Sign out"),
  );
  const me = ctx?.me;
  const usage =
    me && me.linksLimit !== null
      ? h(
          "div",
          { class: "row-between" },
          h("span", { class: "usage" }, usageText(me.linksUsedThisMonth, me.linksLimit)),
          h("button", { type: "button", class: "link", onClick: () => openTab(me.upgradeUrl) }, "Upgrade"),
        )
      : null;
  return h("footer", { class: "footer" }, usage, links);
};

const domainOptions = (domains: Me["domains"]) =>
  domains.length
    ? domains.map((d) => h("option", { value: d.domain, selected: d.isDefault }, d.domain))
    : [h("option", { value: "" }, "Default domain")];

/** Puts a fresh /me into the open view: plan badge, footer counts and the Customize domains. */
const applyMe = (ctx: Ctx, me: Me) => {
  const domainsChanged = JSON.stringify(ctx.me.domains) !== JSON.stringify(me.domains);
  ctx.me = me;
  void meCache.save(me);
  setPlan(me);
  app.querySelector(":scope > footer")?.replaceWith(footer(ctx));
  const select = document.getElementById("custom-domain");
  if (domainsChanged && select instanceof HTMLSelectElement) {
    const chosen = select.value;
    select.replaceChildren(...domainOptions(me.domains));
    select.disabled = me.domains.length === 0;
    if (me.domains.some((d) => d.domain === chosen)) select.value = chosen;
  }
};

const refreshFooter = (ctx: Ctx) => {
  void ctx.api
    .me()
    .then((me) => {
      if (ctx.gen === generation) applyMe(ctx, me);
    })
    .catch(() => {
      // keep the previous counts; the next popup open refreshes them
    });
};

const skeleton = (height: number, width = "100%") =>
  h("div", { class: "skeleton", style: `height:${height}px;width:${width}`, "aria-hidden": "true" });

const loadingView = (view: string, label: string) => {
  app.setAttribute("aria-busy", "true");
  app.replaceChildren(
    h("span", { class: "sr-only" }, label),
    h("div", { class: "stack" }, skeleton(12, "80px"), skeleton(44)),
    skeleton(186),
    skeleton(34),
  );
  app.dataset.view = view;
};

// ---------------------------------------------------------------------------
// Not connected

const showNotConnected = async (notice?: string) => {
  const gen = ++generation;
  setPlan(null);

  let message = notice;
  if (!message) {
    const status = await session.get("connectStatus");
    if (status && Date.now() - status.at < CONNECT_STATUS_TTL_MS) {
      message =
        status.status === "error"
          ? status.message
          : "Finish connecting in the iShortn window, then open this popup again.";
    }
  }

  const connectBtn = button("Connect iShortn", () => {
    connectBtn.disabled = true;
    setButtonLabel(connectBtn, "Waiting for sign-in...");
    void ext.runtime.sendMessage({ type: "connect" }).catch(() => {
      connectBtn.disabled = false;
      setButtonLabel(connectBtn, "Connect iShortn");
    });
  }, { primary: true, block: true, large: true });

  const page = isShortenableUrl(tabUrl)
    ? h(
        "section",
        { class: "stack", "aria-label": "QR code for this page" },
        h("p", { class: "eyebrow" }, "QR code for this page"),
        await qrCard(tabUrl, [h("p", { class: "url", title: tabUrl }, displayUrl(tabUrl)), qrActions(tabUrl, "Copy URL")]),
      )
    : note("QR codes and short links work on web pages. Open a site, then click iShortn again.");

  const panel = h(
    "section",
    { class: "panel", "aria-labelledby": "connect-title" },
    h("div", { class: "stack" },
      h("h1", { class: "title", id: "connect-title" }, "Get a short link you can edit and track"),
      h("p", { class: "text" }, "Connect your iShortn account to shorten pages in one click, change where links point later and see their clicks."),
    ),
    connectBtn,
    h(
      "p",
      { class: "meta", style: "text-align:center" },
      "No account? ",
      h("button", { type: "button", class: "link", onClick: () => openTab(urls.signUp(BASE_URL, isShortenableUrl(tabUrl) ? tabUrl : null)) }, "Create a free account"),
    ),
  );

  if (gen !== generation) return;
  mount("not-connected", message ? note(message, "alert") : null, page, panel);
  connectBtn.focus();
};

const disconnect = async (message: string) => {
  // Bump first so a second failing request (or a late /me) can't render or cache over this.
  generation++;
  await meCache.clear();
  await local.remove("token");
  await session.remove("linkCache");
  await showNotConnected(message);
};

const signOut = async (api: Api | null) => {
  generation++;
  if (api) {
    const timeout = new Promise((resolve) => window.setTimeout(resolve, SIGN_OUT_TIMEOUT_MS));
    // Revoking is best effort: the local token is removed either way.
    await Promise.race([api.signOut(), timeout]).catch(() => undefined);
  }
  await meCache.clear();
  await local.remove("token");
  await local.remove("autoShorten");
  await session.remove("linkCache");
  await showNotConnected("Signed out. This browser is no longer connected to iShortn.");
};

// ---------------------------------------------------------------------------
// Connected

const handleFatal = async (error: unknown, retry: () => void) => {
  const ui = toUiError(error);
  if (ui.kind === "unauthorized") return disconnect(ui.message);
  generation++;
  setPlan(null);
  const action = errorAction(ui, retry);
  mount("error", alertBox(ui, action), footer(null));
  action?.focus();
};

const toUiError = (error: unknown): UiError =>
  error instanceof ApiError
    ? mapApiError(error.status, error.body, error.retryAfter)
    : mapApiError(0, null, null);

const cacheLink = async (url: string, link: CreatedLink) => {
  const cache = await session.get("linkCache");
  await session.set(
    "linkCache",
    withCachedLink(cache, url, { shortUrl: link.shortUrl, alias: link.alias, domain: link.domain, createdAt: link.createdAt }, Date.now()),
  );
};

const showConnected = async (token: string) => {
  const gen = ++generation;
  const api = createApi(BASE_URL, token);
  const retry = () => void showConnected(token);
  loadingView("loading", "Loading");

  const mePromise = api.me();
  mePromise.catch(() => undefined);
  const recentPromise = isShortenableUrl(tabUrl) ? null : api.recentLinks(5);
  recentPromise?.catch(() => undefined);

  const [cachedMe, linkCache, storedAuto] = await Promise.all([
    meCache.load(),
    session.get("linkCache"),
    local.get("autoShorten"),
  ]);
  if (gen !== generation) return;

  // Start creating in parallel with /me whenever the answer is already known: from the saved
  // switch, or from the cached plan's default.
  const pageUrl = isShortenableUrl(tabUrl) ? tabUrl : null;
  const cachedLink = pageUrl ? lookupCachedLink(linkCache, pageUrl, Date.now()) : null;
  const autoKnown = cachedMe ? shouldAutoShorten(storedAuto, cachedMe.plan) : storedAuto === true;
  const earlyCreate = pageUrl && !cachedLink && autoKnown ? api.createLink({ url: pageUrl }) : null;
  earlyCreate?.catch(() => undefined);

  const target: Target = { recentPromise, cachedLink, storedAuto, earlyCreate };

  if (cachedMe) {
    // Render from the last known account now and revalidate behind it.
    const ctx: Ctx = { api, me: cachedMe, gen };
    setPlan(cachedMe);
    revalidate(ctx, mePromise);
    return showTarget(ctx, target);
  }

  let me: Me;
  try {
    me = await mePromise;
  } catch (error) {
    if (gen === generation) await handleFatal(error, retry);
    return;
  }
  if (gen !== generation) return;
  void meCache.save(me);
  setPlan(me);
  return showTarget({ api, me, gen }, target);
};

const revalidate = (ctx: Ctx, mePromise: Promise<Me>) => {
  mePromise
    .then((me) => {
      if (ctx.gen === generation) applyMe(ctx, me);
    })
    .catch((error: unknown) => {
      if (ctx.gen !== generation) return;
      const ui = toUiError(error);
      if (ui.kind === "unauthorized") void disconnect(ui.message);
      // Anything else keeps the cached view; the next open tries again.
    });
};

type Target = {
  recentPromise: Promise<RecentLink[]> | null;
  cachedLink: CachedLink | null;
  storedAuto: boolean | undefined;
  earlyCreate: Promise<CreatedLink> | null;
};

const showTarget = (ctx: Ctx, { recentPromise, cachedLink, storedAuto, earlyCreate }: Target) => {
  if (recentPromise) return showUnshortenable(ctx, recentPromise);
  if (!isShortenableUrl(tabUrl)) return;
  const auto = shouldAutoShorten(storedAuto, ctx.me.plan);
  if (cachedLink) return showResult(ctx, toShown(cachedLink, tabUrl), auto, true);
  if (!auto) return showManual(ctx, auto);
  return shortenPage(ctx, auto, earlyCreate);
};

const toShown = (link: CachedLink | CreatedLink, url: string): ShownLink => ({
  shortUrl: link.shortUrl,
  alias: link.alias,
  domain: link.domain,
  url,
});

/** The tab's own QR card, shown before there is a short link. */
const pageSection = async (pageUrl: string) =>
  h(
    "section",
    { class: "stack", "aria-label": "This page" },
    h("p", { class: "eyebrow" }, "This page"),
    await qrCard(pageUrl, [h("p", { class: "url", title: pageUrl }, displayUrl(pageUrl)), qrActions(pageUrl, "Copy URL")]),
  );

const shortenPage = async (ctx: Ctx, auto: boolean, pending: Promise<CreatedLink> | null) => {
  if (!isShortenableUrl(tabUrl)) return;
  const pageUrl = tabUrl;
  const request = pending ?? ctx.api.createLink({ url: pageUrl });
  request.catch(() => undefined);

  // While the link is created, show what's already useful: the page and its QR code.
  const page = await pageSection(pageUrl);
  if (ctx.gen !== generation) return;
  mount(
    "creating",
    h(
      "section",
      { class: "stack", "aria-label": "Short link", "aria-busy": "true" },
      h("label", { class: "eyebrow", for: "short-link" }, "Short link"),
      h("input", {
        class: "input short-field",
        id: "short-link",
        type: "text",
        readonly: true,
        disabled: true,
        placeholder: "Creating short link…",
      }),
    ),
    page,
    autoShortenSwitch(auto),
    footer(ctx),
  );

  let link: CreatedLink;
  try {
    link = await request;
  } catch (error) {
    if (ctx.gen !== generation) return;
    const ui = toUiError(error);
    if (ui.kind === "unauthorized") return disconnect(ui.message);
    return showShortenError(ctx, readAuto(), ui);
  }
  if (ctx.gen !== generation) return;
  await cacheLink(pageUrl, link);
  await showResult(ctx, toShown(link, pageUrl), readAuto(), true, true);
};

const showManual = async (ctx: Ctx, auto: boolean) => {
  if (!isShortenableUrl(tabUrl)) return;
  const pageUrl = tabUrl;
  const shortenBtn = button("Shorten & copy", () => {
    shortenBtn.disabled = true;
    setButtonLabel(shortenBtn, "Shortening...");
    void shortenPage(ctx, readAuto(), null);
  }, { primary: true, block: true, large: true });

  const page = await pageSection(pageUrl);
  if (ctx.gen !== generation) return;
  mount(
    "manual",
    page,
    shortenBtn,
    autoShortenSwitch(auto),
    footer(ctx),
  );
  shortenBtn.focus();
};

const readAuto = () => {
  const input = document.getElementById("auto-shorten");
  return input instanceof HTMLInputElement ? input.checked : false;
};

const showShortenError = async (ctx: Ctx, auto: boolean, ui: UiError) => {
  if (!isShortenableUrl(tabUrl)) return;
  const pageUrl = tabUrl;
  const action = errorAction(ui, () => void shortenPage(ctx, readAuto(), null));
  const page = await pageSection(pageUrl);
  if (ctx.gen !== generation) return;
  mount(
    ui.kind === "upgrade" ? "limit" : "shorten-error",
    alertBox(ui, action),
    page,
    autoShortenSwitch(auto),
    footer(ctx),
  );
  action?.focus();
};

/** Short link field, copy status and QR. Used for the tab result and for pasted links. */
const resultBlock = async (link: ShownLink, copyNow: boolean) => {
  const copied = h("span", { class: "copied", "aria-hidden": "true" }, icon("check", 12, 2), "Copied");
  const field = h("input", {
    class: "input short-field",
    id: "short-link",
    type: "text",
    readonly: true,
    value: link.shortUrl,
    "aria-label": "Short link",
    spellcheck: "false",
  });
  field.addEventListener("focus", () => field.select());

  const markCopied = (ok: boolean) => {
    copied.dataset.shown = String(ok);
    announce(ok ? "Copied" : "Short link ready. Press Copy link to copy it.");
  };

  const qr = await qrCard(link.shortUrl, [
    h("p", { class: "meta" }, "Scan to open the short link, or save the code for print."),
    qrActions(link.shortUrl, "Copy link"),
  ]);
  const block = h(
    "section",
    { class: "stack", "aria-label": "Short link" },
    h("div", { class: "row-between" }, h("label", { class: "eyebrow", for: "short-link" }, "Short link"), copied),
    field,
    h("p", { class: "meta truncate", title: link.url }, `→ ${displayUrl(link.url)}`),
    qr,
  );

  const afterMount = () => {
    field.focus();
    field.select();
    if (copyNow) void copyText(link.shortUrl).then(markCopied);
  };
  return { block, qr, afterMount };
};

const showResult = async (
  ctx: Ctx,
  link: ShownLink,
  auto: boolean,
  copyNow: boolean,
  refreshUsage = false,
) => {
  const { block, qr, afterMount } = await resultBlock(link, copyNow);
  const foot = footer(ctx);
  if (ctx.gen !== generation) return;
  // The form replaces the QR while open: Create makes a new link with its own code, and the
  // popup stays within the 600px height browsers allow.
  const panel = customize(ctx, link, (open) => {
    qr.hidden = open;
  });
  mount(copyNow ? "created" : "result", block, panel, autoShortenSwitch(auto), foot);
  afterMount();
  if (refreshUsage) refreshFooter(ctx);
};

const customize = (ctx: Ctx, link: ShownLink, onToggle: (open: boolean) => void) => {
  const panelId = "customize-panel";
  const toggle = h(
    "button",
    { type: "button", class: "disclosure", "aria-expanded": "false", "aria-controls": panelId },
    icon("chevronRight", 14),
    "Customize",
  );

  const domains = ctx.me.domains;
  const select = h(
    "select",
    { class: "select", id: "custom-domain", disabled: domains.length === 0 },
    ...domainOptions(domains),
  );
  const alias = h("input", {
    class: "input",
    id: "custom-alias",
    type: "text",
    placeholder: link.alias || "my-link",
    autocomplete: "off",
    spellcheck: "false",
    maxlength: 64,
  });
  const errorSlot = h("div", { class: "stack error-slot", hidden: true });
  const createBtn = h("button", { type: "submit", class: "btn btn-primary" }, h("span", {}, "Create"));

  const form = h(
    "form",
    { class: "customize", id: panelId, hidden: true, novalidate: true },
    h(
      "div",
      { class: "customize-fields" },
      h("div", { class: "stack" }, h("label", { class: "label", for: "custom-domain" }, "Domain"), select),
      h("div", { class: "stack" }, h("label", { class: "label", for: "custom-alias" }, "Alias"), alias),
    ),
    errorSlot,
    h("div", { class: "row-between" }, h("p", { class: "meta" }, "Creates a new link for this page."), createBtn),
  );

  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    form.hidden = !open;
    onToggle(open);
    if (open) alias.focus();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void (async () => {
      errorSlot.replaceChildren();
      errorSlot.hidden = true;
      createBtn.disabled = true;
      setButtonLabel(createBtn, "Creating...");
      const input = {
        url: link.url,
        alias: alias.value.trim() || undefined,
        domain: select.value || undefined,
      };
      try {
        const created = await ctx.api.createLink(input);
        if (ctx.gen !== generation) return;
        if (link.url === tabUrl) await cacheLink(link.url, created);
        await showResult(ctx, toShown(created, link.url), readAuto(), true, true);
      } catch (error) {
        if (ctx.gen !== generation) return;
        const ui = toUiError(error);
        if (ui.kind === "unauthorized") return disconnect(ui.message);
        createBtn.disabled = false;
        setButtonLabel(createBtn, "Create");
        const action = errorAction(ui, null);
        errorSlot.replaceChildren(
          h("p", { class: "field-error", role: "alert" }, ui.message),
          ...(action ? [action] : []),
        );
        errorSlot.hidden = false;
        alias.focus();
      }
    })();
  });

  return h("div", { class: "stack" }, toggle, form);
};

// ---------------------------------------------------------------------------
// Unshortenable tab (browser pages, stores, files)

const recentList = (links: Array<{ shortUrl: string; url: string }>) => {
  if (!links.length) return h("div", { class: "empty" }, "No links yet");
  return h(
    "ul",
    { class: "list" },
    ...links.map((link) => {
      const copyBtn = h(
        "button",
        { type: "button", class: "icon-btn", "aria-label": `Copy ${displayUrl(link.shortUrl)}` },
        icon("copy", 14),
      );
      copyBtn.addEventListener("click", () => {
        void copyText(link.shortUrl).then((ok) => {
          if (!ok) return announce("Couldn't copy the link.");
          announce("Copied");
          copyBtn.replaceChildren(icon("check", 14, 2));
          window.setTimeout(() => copyBtn.replaceChildren(icon("copy", 14)), 1500);
        });
      });
      return h(
        "li",
        {},
        h(
          "div",
          { class: "stack", style: "gap:1px;flex:1" },
          h("span", { class: "short truncate", title: link.shortUrl }, displayUrl(link.shortUrl)),
          h("span", { class: "meta truncate", title: link.url }, displayUrl(link.url)),
        ),
        copyBtn,
      );
    }),
  );
};

const showUnshortenable = async (
  ctx: Ctx,
  recentPromise: Promise<Array<{ shortUrl: string; url: string }>>,
) => {
  const input = h("input", {
    class: "input",
    id: "paste-url",
    type: "url",
    inputmode: "url",
    placeholder: "https://example.com/page",
    autocomplete: "off",
    spellcheck: "false",
  });
  const submit = h("button", { type: "submit", class: "btn btn-primary" }, h("span", {}, "Shorten"));
  const resultSlot = h("div", { class: "stack", style: "gap:14px" });
  const recentSlot = h("div", { class: "stack" }, skeleton(120));
  const recentSection = h(
    "section",
    { class: "stack", "aria-label": "Recent links" },
    h("p", { class: "eyebrow" }, "Recent links"),
    recentSlot,
  );

  const form = h(
    "form",
    { class: "stack", novalidate: true },
    h("label", { class: "label", for: "paste-url" }, "Paste a link to shorten"),
    h("div", { class: "row" }, input, submit),
  );

  const loadRecent = (promise: Promise<Array<{ shortUrl: string; url: string }>>) => {
    void promise
      .then((links) => {
        if (ctx.gen === generation) recentSlot.replaceChildren(recentList(links));
      })
      .catch(() => {
        if (ctx.gen === generation) recentSlot.replaceChildren(h("p", { class: "meta" }, "Couldn't load recent links."));
      });
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void (async () => {
      const url = normalizePastedUrl(input.value);
      if (!url) {
        resultSlot.replaceChildren(h("p", { class: "field-error", role: "alert" }, "Enter a web address starting with http:// or https://."));
        input.focus();
        return;
      }
      submit.disabled = true;
      setButtonLabel(submit, "Shortening...");
      try {
        const created = await ctx.api.createLink({ url });
        if (ctx.gen !== generation) return;
        const { block, afterMount } = await resultBlock(toShown(created, url), true);
        resultSlot.replaceChildren(block);
        app.dataset.view = "unshortenable-created";
        afterMount();
        input.value = "";
        // The new link takes the recent list's place so the popup stays within 600px.
        recentSection.hidden = true;
        refreshFooter(ctx);
      } catch (error) {
        if (ctx.gen !== generation) return;
        const ui = toUiError(error);
        if (ui.kind === "unauthorized") return disconnect(ui.message);
        const action = errorAction(ui, () => form.requestSubmit());
        resultSlot.replaceChildren(alertBox(ui, action));
        (action ?? input).focus();
      } finally {
        submit.disabled = false;
        setButtonLabel(submit, "Shorten");
      }
    })();
  });

  loadRecent(recentPromise);
  mount(
    "unshortenable",
    note("This page can't be shortened. Paste a link instead."),
    form,
    resultSlot,
    recentSection,
    footer(ctx),
  );
  input.focus();
};

// ---------------------------------------------------------------------------
// Entry

const start = async () => {
  tabUrl = await activeTabUrl();
  const token = await local.get("token");
  if (!token) return showNotConnected();
  return showConnected(token);
};

// Re-render when another context changes the token (connect finished, signed out elsewhere).
ext.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !("token" in changes)) return;
  const { oldValue, newValue } = changes.token ?? {};
  if (oldValue === newValue) return;
  void meCache.clear().then(() => {
    if (newValue && !oldValue) return start();
  });
});

// Enter runs the page's primary action when nothing in particular has focus.
document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || document.activeElement !== document.body) return;
  const primary = app.querySelector<HTMLButtonElement>(".btn-primary:not(:disabled)");
  primary?.click();
});

void start();
