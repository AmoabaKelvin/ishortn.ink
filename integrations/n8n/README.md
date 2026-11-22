# n8n-nodes-ishortn

n8n community nodes for [iShortn](https://ishortn.ink?utm_source=n8n&utm_medium=integration&utm_campaign=n8n_nodes): shorten URLs, manage short links, read their click analytics and start workflows when a link is created.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

## Installation

In n8n, open **Settings → Community Nodes**, click **Install** and enter `n8n-nodes-ishortn`. See the [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

## Credentials

The nodes use the iShortn API, which needs a **Pro** or **Ultra** plan ([compare plans](https://ishortn.ink/pricing?utm_source=n8n&utm_medium=integration&utm_campaign=n8n_nodes)).

1. Open [Settings → API Keys](https://ishortn.ink/dashboard/settings?utm_source=n8n&utm_medium=integration&utm_campaign=n8n_nodes#api-keys) in the iShortn dashboard.
2. Click **Create API Key** and copy the key. It's shown only once.
3. In n8n, create an **iShortn API** credential and paste the key into **API Key**. Leave **Base URL** as `https://ishortn.ink` unless you host iShortn yourself.

## Operations

**iShortn**

- Link: Create, Get, Get Many (with Return All), Update, Delete
- Analytics: Get (total clicks, daily clicks, and clicks by country, city, device, browser, OS and referrer)

**iShortn Trigger**

- New Link: polls your newest links and emits each new link once, oldest first. Links that existed when the workflow was activated don't fire.

Full guide with an example workflow: [iShortn docs → n8n](https://ishortn.ink/docs/integrations/n8n?utm_source=n8n&utm_medium=integration&utm_campaign=n8n_nodes).

## Compatibility

Built with `@n8n/node-cli` 0.57 against `n8n-workflow` 2.x. Tested with n8n 2.48.

## Development

```bash
npm install
npm run dev     # start n8n with these nodes loaded and rebuild on change
npm test        # unit tests (node --test)
npm run lint
npm run build
```

## License

[MIT](LICENSE.md)
