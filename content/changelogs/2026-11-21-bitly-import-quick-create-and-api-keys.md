---
date: 2026-11-21T18:00:00
version: 2.12.0
title: Bitly import, a quick way to shorten your first link, a free UTM builder, and named API keys
shortDesc: Import a Bitly export without editing it, move up to 5,000 links onto your own domain outside the monthly limit, shorten straight from the empty dashboard, tag links with the free UTM builder, and manage several named API keys
category: new
---

Five changes for moving links in, creating them faster and working with the API.

## Import your Bitly links as-is

CSV import now accepts Bitly's link export without any editing. Both the current export and Bitly's older format work.

- Links on a custom domain you've connected to iShortn keep their exact back-half. Printed links and QR codes keep working once the domain's DNS points to iShortn.
- With **Also keep Bitly's original codes working** checked (the default), a custom link also gets its Bitly code, such as `go.example.com/3XCetqn`, as a second link to the same destination.
- `bit.ly` links can't move, because Bitly owns that domain. They're created on your workspace's default domain, keeping the back-half when it's available, and the import lists the new address for each row.
- Rows on a domain you haven't connected yet fail with a message telling you to add it in Domains, wait until it shows **Active**, and import the file again.
- Rows deleted in Bitly are skipped. Importing the same file again creates no duplicates, so after connecting a domain you can re-upload the whole file.

CSV import is on Pro and Ultra. The [Move your links from Bitly](/docs/migrate-from-bitly) guide covers the export, the DNS change and the import step by step.

## 5,000 imported links on your own domain, outside the monthly limit

On Pro, rows in a CSV import that are on one of your workspace's active custom domains now use a one-time allowance of 5,000 links instead of your monthly link limit, so you can move a branded domain from another shortener in one go. The allowance doesn't reset: once it's used up, those rows count toward the monthly limit like any other. Rows on iShortn's shared domains always count toward the monthly limit, and the import summary shows how many rows used the allowance and how many are left.

The Free plan doesn't include CSV import, so the allowance doesn't apply there. Ultra and team workspaces have no monthly link limit, so they don't need it.

## Shorten from the empty dashboard and see your short link

- A workspace with no links now shows a URL field on the dashboard. Paste a link, click **Shorten**, then copy the short link or open its QR code right there. **More options** takes you to the full create page for a custom alias, tags or expiry.
- After you create a link on the create page, a dialog shows the short link with **Copy link**, a QR code preview and **Download PNG**. You can create another link straight from the dialog.
- Link cards for named links now show `domain/alias` under the name, so you can see the short link without opening it.
- The **Create Link** button on the create page now sits right after the main fields and stays on screen while you scroll through the advanced sections.

## Free UTM builder

The new [UTM builder](/utm-builder) adds campaign tags to your links for free, without an account.

- **One link:** enter a URL and the source, medium and campaign, plus content, term and campaign ID if you need them. Quick-fill buttons set the source and medium for common channels such as Newsletter, Instagram and Google Ads. Paste a link that already has UTM tags and the empty fields fill in from it. Values are lowercased with underscores for spaces unless you turn that off.
- **Many links:** paste up to 1,000 URLs and tag them all at once. Copy the list or download it as a CSV that imports straight into iShortn.
- **Shorten this link** opens the iShortn create page with the tagged URL filled in.

The builder runs in your browser and doesn't save what you type.

## Named API keys and JSON errors

In [Settings → API Keys](/dashboard/settings#api-keys) you can now:

- create up to 25 keys, each with its own name;
- see each key's prefix (its first 6 characters), when it was created and when it was last used (updated at most once an hour);
- revoke a key you no longer need, after a confirmation.

Keys created before this change are listed as "API key" with no prefix.

The API now has `DELETE /api/v1/links/{alias}`, which deletes a link in your personal workspace and returns `204`.

API errors now return JSON instead of plain text, in the shape `{ "error": { "code", "message", "details" } }`. For validation errors, `details` lists each field that failed. Status codes are unchanged except in four cases:

- A `POST` body that isn't valid JSON returns `400` instead of `500`.
- Asking for password protection or UTM parameters on a plan without them returns `403` instead of `400`.
- Unexpected server errors on `POST` return `500` instead of `400`.
- `PATCH` now rejects aliases that are too short for the Free plan, the same check the dashboard uses.

See [Responses and errors](/docs/api#responses-and-errors) in the API reference for every error code.
