# iShortn

Shorten links with [iShortn](https://ishortn.ink?utm_source=raycast&utm_medium=integration&utm_campaign=raycast_extension) and check how they're doing, without leaving Raycast.

## Commands

- **Shorten Link**: a form with the URL (filled in from your selection or clipboard), an optional alias and an optional domain. The short link is copied to your clipboard.
- **Shorten Clipboard URL**: shortens the URL on your clipboard in one step and copies the short link. Assign it a hotkey for one-keystroke shortening.
- **Link Analytics**: enter an alias or paste a short link to see total clicks and the top countries, devices and referrers.

## Setup

The extension uses the iShortn API, which needs a **Pro** or **Ultra** plan ([compare plans](https://ishortn.ink/pricing?utm_source=raycast&utm_medium=integration&utm_campaign=raycast_extension)).

1. Open [Settings → API Keys](https://ishortn.ink/dashboard/settings?utm_source=raycast&utm_medium=integration&utm_campaign=raycast_extension#api-keys) in the iShortn dashboard.
2. Click **Create API Key** and copy the key. It's shown only once.
3. Paste it into the **API Key** preference when Raycast asks for it.

Optionally set **Default Domain** (for example `isht.ink` or one of your custom domains) for new links and for Link Analytics lookups by alias. When it's empty, the default domain from your iShortn settings is used.

Full guide: [iShortn docs → Raycast](https://ishortn.ink/docs/integrations/raycast?utm_source=raycast&utm_medium=integration&utm_campaign=raycast_extension).

## Development

```bash
npm install
npm run dev     # open the extension in Raycast
npm test        # unit tests (node --test)
npm run lint
npm run build
```
