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

## Releasing

Releases are published to npm with provenance by the [`publish-n8n.yml`](https://github.com/AmoabaKelvin/ishortn.ink/blob/main/.github/workflows/publish-n8n.yml) GitHub Actions workflow. Don't run `npm publish` locally.

1. Bump the version in `package.json` and `package-lock.json`: `npm version X.Y.Z --no-git-tag-version`.
2. Add an `## X.Y.Z` entry to `CHANGELOG.md`.
3. Merge those changes to `main`, then tag the merge commit and push the tag:

   ```bash
   git tag n8n-vX.Y.Z
   git push origin n8n-vX.Y.Z
   ```

The workflow fails without publishing if the tag doesn't match the `package.json` version. To retry a failed release, run the workflow manually and pick the tag under **Use workflow from**.

## License

[MIT](LICENSE.md)
