/**
 * Emails every owner of a custom domain that has not yet moved to Cloudflare.
 *
 * Usage (from repo root, against production env):
 *   set -a; source .env.production.local; set +a
 *   bun scripts/send-migration-emails.ts             # dry run
 *   bun scripts/send-migration-emails.ts --preview <to> [--account <email>]
 *   bun scripts/send-migration-emails.ts --send
 *
 * Add --reminder to any of the above to send the follow-up wording instead.
 */
import mysql from "mysql2/promise";
import { Resend } from "resend";

import DomainMigrationEmail from "../src/emails/domain-migration";

const CNAME_TARGET = process.env.CUSTOM_DOMAIN_CNAME_TARGET ?? "cname.ishortn.ink";
const DASHBOARD_URL = "https://ishortn.ink/dashboard/domains";
const FROM = "Kelvin from iShortn <kelvin@ishortn.ink>";
const SUBJECT = "Action needed: update your custom domain DNS by August 22";
const REMINDER_SUBJECT = "Reminder: update your custom domain DNS by Friday, August 22";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

function deadlineText(): string {
  const raw = process.env.NEXT_PUBLIC_DOMAIN_MIGRATION_DEADLINE;
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return `on ${parsed.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })}`;
    }
  }
  return "in the coming weeks";
}

async function fetchMigratedHostnames(): Promise<Set<string>> {
  const zoneId = required("CLOUDFLARE_SAAS_ZONE_ID");
  const token = required("CLOUDFLARE_API_TOKEN");
  const migrated = new Set<string>();

  for (let page = 1; ; page++) {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames?per_page=100&page=${page}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = (await response.json()) as {
      success: boolean;
      result: { hostname: string; status: string; ssl?: { status: string } | null }[];
    };
    if (!data.success) throw new Error("Cloudflare custom hostname list failed");
    for (const h of data.result) {
      if (h.status === "active" && h.ssl?.status === "active") {
        migrated.add(h.hostname.toLowerCase());
      }
    }
    if (data.result.length < 100) break;
  }
  return migrated;
}

type OwnerRow = { domain: string; email: string | null; name: string | null };

async function fetchOwners(): Promise<OwnerRow[]> {
  const conn = await mysql.createConnection(required("DATABASE_URL"));
  const [rows] = await conn.query(`
    SELECT cd.domain, u.email, u.name
    FROM CustomDomain cd
    LEFT JOIN User u ON u.id = cd.userId
    WHERE cd.domain IS NOT NULL
  `);
  await conn.end();
  return rows as OwnerRow[];
}

type Recipient = { email: string; name: string | null; domains: string[] };

function groupRecipients(rows: OwnerRow[], migrated: Set<string>): Recipient[] {
  const byEmail = new Map<string, Recipient>();
  for (const row of rows) {
    if (!row.email) {
      console.warn(`skipping ${row.domain}: owner has no email`);
      continue;
    }
    const domain = row.domain.toLowerCase();
    if (migrated.has(domain)) continue;
    const entry = byEmail.get(row.email) ?? { email: row.email, name: row.name, domains: [] };
    if (!entry.domains.includes(domain)) entry.domains.push(domain);
    byEmail.set(row.email, entry);
  }
  return [...byEmail.values()]
    .filter((r) => r.domains.length > 0)
    .sort((a, b) => a.email.localeCompare(b.email));
}

function firstName(name: string | null): string | null {
  const first = name?.trim().split(/\s+/)[0];
  if (!first) return null;
  return first[0]!.toUpperCase() + first.slice(1).toLowerCase();
}

function buildEmail(recipient: Recipient) {
  return DomainMigrationEmail({
    recipientName: firstName(recipient.name ?? null),
    domains: recipient.domains
      .sort()
      .map((domain) => ({ domain, isApex: domain.split(".").length === 2 })),
    cnameTarget: CNAME_TARGET,
    deadlineText: deadlineText(),
    dashboardUrl: DASHBOARD_URL,
    isReminder: reminder,
  });
}

const args = process.argv.slice(2);
const previewIndex = args.indexOf("--preview");
const accountIndex = args.indexOf("--account");
const send = args.includes("--send");
const reminder = args.includes("--reminder");
const subject = reminder ? REMINDER_SUBJECT : SUBJECT;

const rows = await fetchOwners();
const migrated = await fetchMigratedHostnames();
const recipients = groupRecipients(rows, migrated);

if (previewIndex !== -1) {
  const to = args[previewIndex + 1];
  if (!to) throw new Error("--preview needs a recipient address");
  const account = accountIndex !== -1 ? args[accountIndex + 1] : "kelvinamoaba@gmail.com";
  // Preview ignores migration status so an already-migrated account still renders.
  const accountRows = rows.filter((r) => r.email === account);
  if (accountRows.length === 0) throw new Error(`no domains found for account ${account}`);
  const recipient: Recipient = {
    email: to,
    name: accountRows[0]?.name ?? null,
    domains: [...new Set(accountRows.map((r) => r.domain.toLowerCase()))],
  };
  const resend = new Resend(required("RESEND_API_KEY"));
  const result = await resend.emails.send({
    from: FROM,
    to,
    subject: `[PREVIEW] ${subject}`,
    react: buildEmail(recipient),
  });
  if (result.error) throw new Error(`Resend error: ${result.error.message}`);
  console.log(`preview sent to ${to} (id ${result.data?.id}) using ${account}'s domains:`);
  console.log(recipient.domains.join(", "));
} else if (send) {
  const resend = new Resend(required("RESEND_API_KEY"));
  let sent = 0;
  const failed: string[] = [];
  for (const recipient of recipients) {
    const result = await resend.emails.send({
      from: FROM,
      to: recipient.email,
      subject,
      react: buildEmail(recipient),
    });
    if (result.error) {
      failed.push(`${recipient.email}: ${result.error.message}`);
    } else {
      sent++;
      console.log(`sent to ${recipient.email} (${recipient.domains.length} domains)`);
    }
    // Resend allows 2 requests/second.
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  console.log(`\ndone: ${sent} sent, ${failed.length} failed`);
  for (const f of failed) console.error(f);
} else {
  console.log(`dry run — ${recipients.length} recipients, no emails sent:\n`);
  for (const r of recipients) {
    console.log(`${r.email}\n  ${r.domains.sort().join("\n  ")}`);
  }
  console.log("\nrun with --send to deliver, or --preview <to> to send yourself a sample");
}
