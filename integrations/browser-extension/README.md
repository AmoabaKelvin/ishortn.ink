# iShortn browser extension

Shorten the page you're on with [iShortn](https://ishortn.ink?utm_source=browser-extension&utm_medium=integration&utm_campaign=extension_readme) from the toolbar. Works in Chrome, Edge and other Chromium browsers, and Firefox 140+.

- **Without an account**: the popup shows a QR code for the current page, generated locally with no network request, with **Download PNG** and **Copy URL**.
- **Connected**: one click (or automatic, see below) creates a short link, copies it to the clipboard and shows its QR code. **Customize** creates a link with your own alias and any of your domains. Free plans see their monthly usage with an upgrade link.
- **Browser pages** (`chrome://`, `about:`, extension stores, local files): paste a link to shorten it, and see your five most recent links.
- Keyboard shortcut: `Alt+Shift+S` opens the popup (change it in `chrome://extensions/shortcuts` or Firefox's add-on shortcut settings).

"Shorten automatically when I open the popup" is on by default for Pro and Ultra and off for Free. Reopening the popup on the same page within 10 minutes shows the link already created instead of creating another one.

## Build

Node.js 22.18 or newer (the tests run TypeScript directly with Node's type stripping).

```bash
npm ci
npm run build      # dist/chrome and dist/firefox
npm run zip        # build + dist/ishortn-{chrome,firefox}-<version>.zip for store upload
npm run typecheck
npm test
```

Both builds share the same JavaScript, HTML and CSS; only `manifest.json` differs (`background.service_worker` for Chromium, `background.scripts` plus `browser_specific_settings.gecko` for Firefox).

### Pointing at a local server

The iShortn base URL is fixed at build time and defaults to `https://ishortn.ink`:

```bash
ISHORTN_BASE_URL=http://localhost:3000 npm run build
```

Plain `http://` is accepted only for `localhost` and `127.0.0.1`.

## Load the extension

**Chrome / Edge**: open `chrome://extensions` (or `edge://extensions`), turn on **Developer mode**, click **Load unpacked** and pick `dist/chrome`.

**Firefox**: open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…** and pick `dist/firefox/manifest.json`. Temporary add-ons are removed when Firefox restarts.

After rebuilding, click the reload icon on the extension's card.

## Connecting to iShortn (redirect URI)

**Connect iShortn** opens iShortn in a browser-managed sign-in window (`identity.launchWebAuthFlow`). After you approve, iShortn redirects to the extension's redirect URI with a token in the URL fragment. The server only redirects to URIs listed in its `EXTENSION_REDIRECT_URIS` environment variable (comma-separated, exact match, trailing slash included), so each build you test needs its URI added there.

- **Chrome / Edge**: `https://<extension-id>.chromiumapp.org/`. The id is shown on the extension's card in `chrome://extensions`. Unpacked extensions get an id derived from the folder path, so it changes if you load the build from somewhere else.
- **Firefox**: `https://<hash>.extensions.allizom.org/`. Open the popup, right-click it and choose **Inspect** (or use **Inspect** on `about:debugging`), then run `browser.identity.getRedirectURL()` in the console. The hash is derived from the add-on id (`browser-extension@ishortn.ink`), so it stays the same between loads.

### Stable Chrome id for development (optional)

To keep the same id wherever the unpacked build is loaded, add a public `key` to the Chromium manifest:

1. Generate a key pair: `openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out key.pem` (keep `key.pem` out of git).
2. Get the base64 public key: `openssl rsa -in key.pem -pubout -outform DER | openssl base64 -A`.
3. Build with it: `ISHORTN_EXTENSION_KEY=<base64 public key> npm run build`.

The key is only added to `dist/chrome/manifest.json`. Don't upload a build with a `key` to the Chrome Web Store; the store assigns its own id (whose `chromiumapp.org` URI also goes in `EXTENSION_REDIRECT_URIS`).

The connect flow runs in the background script, not the popup, because the popup closes as soon as the sign-in window takes focus. When it finishes, the extension tries to reopen the popup; if the browser doesn't allow that, click the toolbar button again.

## Permissions

The manifest asks for exactly three permissions and no host permissions:

| Permission  | Why                                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| `activeTab` | Read the URL of the current tab, only after you click the toolbar button or press the shortcut.           |
| `storage`   | Keep the connection token and your auto-shorten choice (`storage.local`), and the 10-minute link cache (`storage.session`). |
| `identity`  | Run the iShortn sign-in window and receive the token on the extension's redirect URI.                     |

There are no content scripts. Requests go only to the configured iShortn base URL, which serves `/api/extension/*` with CORS for any origin, so host permissions aren't needed. The token is stored in `storage.local` (never synced), sent only in the `Authorization` header, and revoked on the server by **Sign out**. You can also revoke it from **Settings → Connected browsers** in the dashboard.

Everything the extension runs is bundled: no remote code, CDN or web fonts. QR codes are generated in the popup with [`qrcode`](https://www.npmjs.com/package/qrcode).

## Development preview

`preview/` holds a dev-only harness that loads the real popup bundle with mocked `chrome.*` APIs and a mocked iShortn API. It's never copied into `dist/`.

```bash
npm run preview
# http://127.0.0.1:4173/popup.html?state=created
# http://127.0.0.1:4173/frame.html?state=created   (popup inside a mock browser window)
```

States: `not-connected`, `manual`, `created`, `customize`, `limit`, `unshortenable`, `unshortenable-empty`, `network-error`.

`npm run screenshots` renders every state in light and dark (2x) to `store/popup-states/` and the three 1280x800 store screenshots to `store/screenshot-{1,2,3}.png`. It uses Playwright's Chromium (`npx playwright-core install chromium` if it isn't installed). On Linux the preview uses Inter, if installed, in place of `system-ui` so the renders are closer to the macOS and Windows UI fonts.

`npm run icons` regenerates `icons/icon-{16,32,48,128}.png` from `icons/icon.svg` (the app icon: white viewfinder mark on a `#0a0a0a` rounded tile). The PNGs are committed, so a normal build doesn't need a browser.

## Layout

```
src/
  popup.html, popup.css, popup.ts   popup UI
  background.ts                     connect flow (launchWebAuthFlow)
  lib/                              API client, storage, and pure logic covered by test/
scripts/                            build, zip, icons, preview server, screenshots
preview/                            dev-only mocks and mock browser frame
store/                              rendered popup states and store screenshots
```
