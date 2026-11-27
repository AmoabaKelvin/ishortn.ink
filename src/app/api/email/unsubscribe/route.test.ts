import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { eq } from "drizzle-orm";

import { env } from "@/env.mjs";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { createUnsubscribeToken } from "@/server/lib/notifications/unsubscribe";

import { GET, POST } from "./route";
import { CONFIRM_FORM_FIELD } from "./unsubscribe-page";

const SECRET = "s".repeat(32);
const USER_ID = "unsubscribe_route_test";
const BASE = "https://ishortn.ink/api/email/unsubscribe";

const urlFor = (token: string, list?: string) =>
  `${BASE}?token=${encodeURIComponent(token)}${list ? `&list=${list}` : ""}`;
const validUrl = (list?: "weekly-summary") =>
  urlFor(createUnsubscribeToken(USER_ID, SECRET, list), list);

// What a browser sends from the confirm page, and what a mail client sends per RFC 8058.
const pagePost = (url: string) =>
  new Request(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: CONFIRM_FORM_FIELD,
  });
const oneClickPost = (url: string) =>
  new Request(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "List-Unsubscribe=One-Click",
  });

let previousSecret: string | undefined;

beforeAll(() => {
  previousSecret = env.EMAIL_UNSUBSCRIBE_SECRET;
  Object.assign(env, { EMAIL_UNSUBSCRIBE_SECRET: SECRET });
});

afterAll(() => {
  Object.assign(env, { EMAIL_UNSUBSCRIBE_SECRET: previousSecret });
});

describe("GET /api/email/unsubscribe", () => {
  test("a valid link asks for confirmation with a form that posts back to the same URL", async () => {
    const response = GET(new Request(validUrl()));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("Stop iShortn product and update emails for this account?");
    expect(html).toContain('<form method="post">');
    expect(html).not.toContain("action=");
    expect(html).toContain('href="https://ishortn.ink/dashboard/settings#notifications"');
  });

  test("names the weekly summary for weekly-summary links", async () => {
    const html = await GET(new Request(validUrl("weekly-summary"))).text();
    expect(html).toContain("Stop the iShortn weekly summary email for this account?");
  });

  test("an invalid, mismatched or missing token shows the invalid-link page", async () => {
    const otherUser = createUnsubscribeToken("someone_else", SECRET);
    for (const url of [
      urlFor("not-a-token"),
      urlFor(`${USER_ID}.${otherUser.split(".")[1]}`),
      urlFor(createUnsubscribeToken(USER_ID, SECRET), "weekly-summary"),
      BASE,
    ]) {
      const response = GET(new Request(url));
      const html = await response.text();
      expect(response.status).toBe(400);
      expect(html).toContain("This link isn't valid");
      expect(html).toContain("notification settings");
      expect(html).not.toContain("<form");
      expect(html).not.toContain(USER_ID);
    }
  });
});

describe("scheduled-report unsubscribe links", () => {
  const reportUrl = (id: string) =>
    urlFor(createUnsubscribeToken(id, SECRET, "scheduled-report"), "scheduled-report");

  test("ask the recipient about this address, without pointing at account settings", async () => {
    const html = await GET(new Request(reportUrl("12:client@example.com"))).text();
    expect(html).toContain("Stop this scheduled iShortn report for this address?");
    expect(html).toContain("Only this report stops.");
    expect(html).not.toContain("notification settings");
    expect(html).not.toContain("client@example.com");
  });

  test("a report token can't be used for another report or another list", async () => {
    const token = createUnsubscribeToken("12:client@example.com", SECRET, "scheduled-report");
    for (const url of [
      urlFor(token.replace("12:", "13:"), "scheduled-report"),
      urlFor(token),
      urlFor(createUnsubscribeToken("12:client@example.com", SECRET), "scheduled-report"),
    ]) {
      expect(GET(new Request(url)).status).toBe(400);
    }
  });
});

describe("POST /api/email/unsubscribe with an invalid token", () => {
  test("a mail client gets a plain 400", async () => {
    const response = await POST(oneClickPost(urlFor("bad.token")));
    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toStartWith("text/plain");
  });

  test("the confirm form gets the invalid-link page", async () => {
    const response = await POST(pagePost(BASE));
    expect(response.status).toBe(400);
    expect(await response.text()).toContain("This link isn't valid");
  });
});

// Runs against a disposable MySQL with the schema pushed (test/setup.ts points the app's db
// client at it); see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("unsubscribe preferences (MySQL)", () => {
  const preferences = async () => {
    const row = await db.query.user.findFirst({ where: eq(schema.user.id, USER_ID) });
    return { product: row?.productEmailsEnabled, weekly: row?.weeklySummaryEnabled };
  };

  beforeAll(() => {
    // Another test file replaces @/env.mjs with a partial object for the whole
    // run, dropping DATABASE_URL; the app's db client reads it on first use.
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
  });

  beforeEach(async () => {
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
    await db.insert(schema.user).values({ id: USER_ID });
  });

  afterAll(async () => {
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
  });

  test("GET changes nothing", async () => {
    await GET(new Request(validUrl())).text();
    await GET(new Request(validUrl("weekly-summary"))).text();
    expect(await preferences()).toEqual({ product: true, weekly: true });
  });

  test("the confirm form turns product emails off and shows the confirmation", async () => {
    const response = await POST(pagePost(validUrl()));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("You're unsubscribed");
    expect(html).toContain("Turn them back on");
    expect(await preferences()).toEqual({ product: false, weekly: true });
  });

  test("a mail client's one-click POST gets a plain 200", async () => {
    const response = await POST(oneClickPost(validUrl()));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toStartWith("text/plain");
    expect(await preferences()).toEqual({ product: false, weekly: true });
  });

  test("a weekly-summary link only turns off the weekly summary", async () => {
    await POST(oneClickPost(validUrl("weekly-summary")));
    expect(await preferences()).toEqual({ product: true, weekly: false });
  });

  test("a scheduled-report link removes that recipient from that report", async () => {
    const [inserted] = await db.insert(schema.scheduledReport).values({
      userId: USER_ID,
      targetType: "link",
      targetId: 1,
      frequency: "weekly",
      recipients: ["client@example.com", "boss@example.com"],
    });
    const id = inserted.insertId;
    try {
      const url = urlFor(
        createUnsubscribeToken(`${id}:client@example.com`, SECRET, "scheduled-report"),
        "scheduled-report",
      );
      const response = await POST(pagePost(url));
      expect(await response.text()).toContain("You won't get this scheduled iShortn report");
      await POST(oneClickPost(url));

      const row = await db.query.scheduledReport.findFirst({
        where: eq(schema.scheduledReport.id, id),
      });
      expect(row?.unsubscribed).toEqual(["client@example.com"]);
      expect(await preferences()).toEqual({ product: true, weekly: true });
    } finally {
      await db.delete(schema.scheduledReport).where(eq(schema.scheduledReport.id, id));
    }
  });

  test("an invalid token changes nothing", async () => {
    await POST(pagePost(urlFor("bad.token")));
    await POST(oneClickPost(urlFor(createUnsubscribeToken(USER_ID, "x".repeat(32)))));
    expect(await preferences()).toEqual({ product: true, weekly: true });
  });
});
