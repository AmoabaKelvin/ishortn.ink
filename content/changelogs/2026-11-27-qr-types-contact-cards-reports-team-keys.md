---
date: 2026-11-27T22:00:00
version: 2.25.0
title: Wi-Fi and contact card QR codes, scheduled email reports and team API keys
shortDesc: Make QR codes for Wi-Fi, email, SMS, phone numbers and plain text, put an editable contact card on your business cards, email link reports to clients every week or month, and give team workspaces their own API keys
category: new
---

## Wi-Fi, email, SMS, phone and text QR codes

**Create QR code** now has more types next to **Link**:

- **Wi-Fi**: enter the network name, password and security type (WPA, WEP or none). Guests scan the code and their phone joins the network. Tick **Hidden network** if your network doesn't broadcast its name.
- **Email**: opens a new email with the address, subject and message filled in.
- **SMS**: opens a text message to your number with an optional message already typed.
- **Phone**: starts a call to your number.
- **Text**: shows your text when scanned, up to 1,000 characters.

These are static codes. The content is stored in the code itself, so they work without an internet connection and don't use your monthly link limit, but scans aren't tracked. You can change a code's content later, then download it again and print the new version. Use **Link** when you need a code you can track and edit after printing.

Static codes are available on every plan and count toward your plan's QR code limit.

## Contact card QR codes

Choose **vCard** to put a contact card on business cards, name badges and email signatures. Fill in your name, organisation, job title, two phone numbers, email, website, address and a note. Scanning the code opens a contact page with a **Save contact** button that adds you to the phone's contacts.

Unlike a plain vCard code, this one stays editable. Change your number, email or job title in the dashboard and every card you've already printed shows the new details. Scans are tracked like any other QR code, and the code uses one link from your monthly limit.

Contact card QR codes are on Pro and Ultra. If you downgrade, your existing cards keep working and you can still edit them.

## Scheduled email reports

Click **Email report** on a link's analytics page, a folder or a campaign to send its stats to up to 5 email addresses on a schedule:

- **Weekly** reports go out every Monday and cover the week before.
- **Monthly** reports go out on the 1st and cover the month before.

Each report shows total clicks and the change from the period before, the top countries, devices and traffic sources, and for folders and campaigns, the top links. If you've shared the link's stats, the report links to the live stats page. Recipients don't need an iShortn account, and each email has an unsubscribe link.

It's an easy way to keep a client or your boss up to date without logging in to send them a screenshot.

Pro includes 3 scheduled reports. Ultra and team workspaces have no limit.

## API keys for team workspaces

Team workspaces now have their own API keys. Owners and admins can create and revoke them under **Settings > Team API Keys** while the team workspace is open. Other members can see the list, including who created each key and when it was last used.

A team key works only in its team workspace. It creates, lists, edits and deletes the team's links, on platform domains or the team's own custom domains, with the team's Ultra limits. It can't reach anyone's personal links or another team's links. Keys belong to the team, so they keep working when the member who created them leaves.

Zapier, n8n, Make, Raycast and the MCP server work with team keys as they are, and `GET /api/v1/me` returns the workspace a key belongs to. A team can have up to 25 keys. The [team docs](/docs/teams) have the details.

Personal API keys haven't changed. They still work in your personal workspace only.
