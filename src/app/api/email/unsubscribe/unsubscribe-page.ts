import { SUPPORT_EMAIL } from "@/lib/constants/app";

import type { UnsubscribeList } from "@/server/lib/notifications/unsubscribe";

// Marks the confirm form's POST so the route can tell it from a mail client's one-click POST.
const CONFIRM_NAME = "source";
const CONFIRM_VALUE = "unsubscribe-page";
export const CONFIRM_FORM_FIELD = `${CONFIRM_NAME}=${CONFIRM_VALUE}`;

export type UnsubscribePageState = "confirm" | "done" | "invalid";

const LIST_NAMES = {
  "product-notifications": "iShortn product and update emails",
  "weekly-summary": "the iShortn weekly summary email",
  "scheduled-report": "this scheduled iShortn report",
} satisfies Record<UnsubscribeList, string>;

// Dashboard palette (neutral / blue-600 in light, the globals.css theme tokens in dark), inlined
// because this page is served straight from the route handler without the app's CSS.
const STYLES = `
:root{color-scheme:light dark;--bg:#fafafa;--card:#fff;--border:#e5e5e5;--title:#171717;--text:#404040;--muted:#737373;--link:#2563eb}
@media (prefers-color-scheme:dark){:root{--bg:hsl(224 14% 10%);--card:hsl(224 14% 13%);--border:hsl(222 13% 19%);--title:hsl(213 10% 90%);--text:#d4d4d4;--muted:#a3a3a3;--link:#60a5fa}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 16px;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.5;-webkit-font-smoothing:antialiased}
main{width:100%;max-width:440px}
.brand{display:flex;align-items:center;gap:8px;margin-bottom:16px;color:var(--title);font-size:14px;font-weight:600;text-decoration:none}
.brand img{width:24px;height:24px;border-radius:6px}
.card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px}
h1{margin:0 0 6px;color:var(--title);font-size:20px;font-weight:600;letter-spacing:-0.01em;text-wrap:balance}
p{margin:0;font-size:13px}
form{margin-top:16px}
button{width:100%;height:36px;padding:0 16px;border:0;border-radius:8px;background:#2563eb;color:#fff;font:inherit;font-size:13px;font-weight:500;cursor:pointer;transition:background-color 150ms ease,transform 160ms ease-out}
button:hover{background:#1d4ed8}
button:active{transform:scale(0.97)}
button:focus-visible,a:focus-visible{outline:2px solid var(--link);outline-offset:2px}
@media (min-width:640px){button{width:auto}}
.meta{margin-top:16px;padding-top:16px;border-top:1px solid var(--border);color:var(--muted);font-size:12px}
.meta a{color:var(--link);text-decoration:none}
.meta a:hover{text-decoration:underline}
`;

const COPY = {
  confirm: (listName, scope) => ({
    title: "Unsubscribe",
    body: `<p>Stop ${listName} ${scope}?</p><form method="post"><input type="hidden" name="${CONFIRM_NAME}" value="${CONFIRM_VALUE}"><button type="submit">Unsubscribe</button></form>`,
    meta: "Account, billing and team emails are always sent. Manage every email in your {settings}.",
  }),
  done: (listName) => ({
    title: "You're unsubscribed",
    body: `<p>You won't get ${listName} any more.</p>`,
    meta: "Changed your mind? Turn them back on in your {settings}.",
  }),
  invalid: () => ({
    title: "This link isn't valid",
    body: "<p>This unsubscribe link is incomplete or no longer works.</p>",
    meta: "You can turn off emails in your {settings}.",
  }),
} satisfies Record<
  UnsubscribePageState,
  (listName: string, scope: string) => { title: string; body: string; meta: string }
>;

// What the unsubscribe applies to: the account, or one report recipient's address.
const LIST_SCOPES = {
  "product-notifications": "for this account",
  "weekly-summary": "for this account",
  "scheduled-report": "for this address",
} satisfies Record<UnsubscribeList, string>;

// Report recipients have no account, so their footer line never points at notification settings.
const REPORT_META = {
  confirm: "Only this report stops. Anything else sent to this address isn't affected.",
  done: "Any other report sent to this address has its own unsubscribe link.",
  invalid: `Write to <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> and we'll take you off it.`,
} satisfies Record<UnsubscribePageState, string>;

/**
 * HTML for people who follow the link in an email footer. It never shows account details, so
 * an invalid link reveals nothing about whether the account exists. The confirm form has no
 * action, so it posts back to the same URL, token included.
 */
export function renderUnsubscribePage(
  state: UnsubscribePageState,
  list: UnsubscribeList,
  settingsUrl: string,
): string {
  const copy = COPY[state](LIST_NAMES[list], LIST_SCOPES[list]);
  const settingsLink = `<a href="${settingsUrl}">notification settings</a>`;
  const { title, body } = copy;
  const meta = list === "scheduled-report" ? REPORT_META[state] : copy.meta;

  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<meta name="robots" content="noindex"><title>${title} · iShortn</title>` +
    `<style>${STYLES}</style></head><body><main>` +
    `<a class="brand" href="/"><img src="/icon.png" alt="" width="24" height="24">iShortn</a>` +
    `<div class="card"><h1>${title}</h1>${body}` +
    `<p class="meta">${meta.replace("{settings}", settingsLink)}</p></div>` +
    `</main></body></html>`
  );
}
