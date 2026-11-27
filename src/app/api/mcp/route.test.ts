import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import crypto from "node:crypto";

import { eq, inArray, like } from "drizzle-orm";
import { z } from "zod";

import { env } from "@/env.mjs";
import { API_RATE_LIMITS, PLAN_VARIANT_IDS } from "@/lib/billing/plans";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { clearApiSunsetCache } from "@/server/lib/api-access";
import { clearPlanLimitHitMemo } from "@/server/lib/plan-limit-hits";

import { GET, OPTIONS, POST } from "./route";
import { readApiKey, SUPPORTED_PROTOCOL_VERSIONS } from "./server";
import { API_PLAN_MESSAGE, listTools } from "./tools";

import type { ToolArguments } from "./tools";

const TOOL_NAMES = [
  "create_link",
  "update_link",
  "get_link",
  "list_links",
  "delete_link",
  "get_link_analytics",
  "create_qr_code",
  "get_account",
];

describe("readApiKey", () => {
  const withHeaders = (headers: Record<string, string>) =>
    new Request("http://localhost/mcp", { headers });

  test("reads a bearer key, then falls back to x-api-key", () => {
    expect(readApiKey(withHeaders({ authorization: "Bearer abc" }))).toBe("abc");
    expect(readApiKey(withHeaders({ authorization: "bearer  abc " }))).toBe("abc");
    expect(readApiKey(withHeaders({ "x-api-key": "xyz" }))).toBe("xyz");
    expect(readApiKey(withHeaders({ authorization: "Basic abc" }))).toBeNull();
    expect(readApiKey(withHeaders({}))).toBeNull();
  });
});

describe("listTools", () => {
  test("describes every tool with an object JSON Schema", () => {
    const tools = listTools();
    expect(tools.map((tool) => tool.name)).toEqual(TOOL_NAMES);
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.annotations.title).toBe(tool.title);
    }
    const createLink = tools.find((tool) => tool.name === "create_link")!;
    expect(createLink.inputSchema.required).toEqual(["url"]);
    expect(tools.find((tool) => tool.name === "delete_link")!.annotations.destructiveHint).toBe(
      true,
    );
  });
});

describe("/mcp transport", () => {
  test("refuses GET with 405 and answers CORS preflight", async () => {
    expect(GET().status).toBe(405);
    const preflight = OPTIONS();
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
  });

  test("answers a request without a key with 401 before reading the body", async () => {
    const response = await POST(
      new Request("http://localhost/api/mcp", { method: "POST", body: "{" }),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toContain("Bearer");
    expect((await response.json()).error.message).toContain("API key");
  });

  test("answers malformed JSON and batches with 400, and notifications with 202", async () => {
    const send = (body: string) =>
      POST(
        new Request("http://localhost/api/mcp", {
          method: "POST",
          headers: { authorization: "Bearer any" },
          body,
        }),
      );
    expect((await send("{")).status).toBe(400);
    const batch = await send(JSON.stringify([{ jsonrpc: "2.0", id: 1, method: "ping" }]));
    expect(batch.status).toBe(400);
    expect((await batch.json()).error.code).toBe(-32600);
    const notification = await send(
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    );
    expect(notification.status).toBe(202);
  });
});

// Runs against a disposable MySQL with the schema pushed (test/setup.ts points
// the app's db client at it); see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("/mcp tools (MySQL)", () => {
  const USER_ID = "mcp_route_test";
  const API_KEY = "mcp-route-test-key";
  const ALIAS = "mcptest-one";
  // localhost is refused by the metadata scraper, so the URL safety check
  // fails open without any network call.
  const TARGET_URL = "http://localhost/mcp-test";
  const originalSunset = env.API_FREE_ACCESS_SUNSET_AT;
  const DAY = 24 * 60 * 60 * 1000;

  beforeAll(() => {
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
  });

  async function cleanup() {
    clearApiSunsetCache();
    clearPlanLimitHitMemo();
    Object.assign(env, { API_FREE_ACCESS_SUNSET_AT: originalSunset });
    const links = await db
      .select({ id: schema.link.id })
      .from(schema.link)
      .where(eq(schema.link.userId, USER_ID));
    if (links.length) {
      const ids = links.map((row) => row.id);
      await db
        .delete(schema.linkPreviousAddress)
        .where(inArray(schema.linkPreviousAddress.linkId, ids));
    }
    await db.delete(schema.reservedAlias).where(like(schema.reservedAlias.alias, "mcptest%"));
    await db.delete(schema.link).where(eq(schema.link.userId, USER_ID));
    await db.delete(schema.planLimitHit).where(eq(schema.planLimitHit.userId, USER_ID));
    await db.delete(schema.subscription).where(eq(schema.subscription.userId, USER_ID));
    await db.delete(schema.token).where(eq(schema.token.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
  }

  async function subscribePro() {
    await db.insert(schema.subscription).values({
      userId: USER_ID,
      status: "active",
      plan: "pro",
      variantId: PLAN_VARIANT_IDS.pro.monthly,
    });
  }

  beforeEach(async () => {
    await cleanup();
    await db.insert(schema.user).values({
      id: USER_ID,
      email: "mcp@example.com",
      name: "Ada Lovelace",
      monthlyLinkCount: 0,
      lastLinkCountReset: new Date(),
      planCheckedAt: new Date(),
    });
    await db.insert(schema.token).values({
      userId: USER_ID,
      token: crypto.createHash("sha256").update(API_KEY).digest("hex"),
    });
  });

  afterAll(cleanup);

  let nextId = 1;
  async function rpc(method: string, params?: ToolArguments, apiKey = API_KEY) {
    const response = await POST(
      new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
      }),
    );
    return { status: response.status, body: await response.json() };
  }

  const toolResult = z.object({
    content: z.array(
      z.object({
        type: z.string(),
        text: z.string().optional(),
        data: z.string().optional(),
        mimeType: z.string().optional(),
      }),
    ),
    isError: z.boolean().optional(),
  });

  async function callTool(name: string, args: ToolArguments = {}) {
    const { status, body } = await rpc("tools/call", { name, arguments: args });
    expect(status).toBe(200);
    const result = toolResult.parse(body.result);
    const first = result.content[0]?.text ?? "";
    return { result, text: first, json: () => JSON.parse(first) };
  }

  test("initializes with a negotiated protocol version and lists the tools", async () => {
    await subscribePro();
    const init = await rpc("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "1" },
    });
    expect(init.status).toBe(200);
    expect(init.body.result).toMatchObject({
      protocolVersion: "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "ishortn" },
    });

    const unknownVersion = await rpc("initialize", { protocolVersion: "1999-01-01" });
    expect(unknownVersion.body.result.protocolVersion).toBe(SUPPORTED_PROTOCOL_VERSIONS[0]);

    const list = await rpc("tools/list");
    expect(list.body.result.tools.map((tool: { name: string }) => tool.name)).toEqual(TOOL_NAMES);
    expect((await rpc("ping")).body.result).toEqual({});
    expect((await rpc("resources/list")).body.error.code).toBe(-32601);
  });

  test("answers an unknown key with 401 on handshakes and tool calls", async () => {
    for (const method of ["initialize", "tools/call"]) {
      const response = await rpc(method, { name: "get_account" }, "not-a-key");
      expect(response.status).toBe(401);
      expect(response.body.error.message).toContain("API key");
    }
    // Calls rejected before reaching the v1 API still check the key first.
    for (const params of [{ name: "create_link", arguments: {} }, { name: "nope" }, {}]) {
      const response = await rpc("tools/call", params, "not-a-key");
      expect(response.status).toBe(401);
    }
  });

  test("a Free key past the API sunset connects but every tool returns the plan error", async () => {
    Object.assign(env, { API_FREE_ACCESS_SUNSET_AT: new Date(Date.now() - DAY).toISOString() });
    expect((await rpc("initialize", { protocolVersion: "2025-06-18" })).status).toBe(200);
    expect((await rpc("tools/list")).status).toBe(200);

    const { result, text } = await callTool("create_link", { url: TARGET_URL });
    expect(result.isError).toBe(true);
    expect(text).toBe(API_PLAN_MESSAGE);
    expect(text).toContain("https://ishortn.ink/pricing");
    const links = await db.select().from(schema.link).where(eq(schema.link.userId, USER_ID));
    expect(links).toHaveLength(0);
  });

  test("create, get, list, update, analytics, QR code and delete a link with a Pro key", async () => {
    await subscribePro();

    const created = await callTool("create_link", { url: TARGET_URL, alias: ALIAS });
    expect(created.result.isError).toBeUndefined();
    expect(created.json()).toMatchObject({
      shortLink: `https://isht.app/${ALIAS}`,
      url: TARGET_URL,
      alias: ALIAS,
    });
    const [row] = await db.select().from(schema.link).where(eq(schema.link.userId, USER_ID));
    expect(row).toMatchObject({ alias: ALIAS, domain: "isht.app", teamId: null });

    const fetched = await callTool("get_link", { alias: ALIAS });
    expect(fetched.json()).toMatchObject({ id: row!.id, alias: ALIAS });

    const listed = await callTool("list_links", { limit: 10 });
    expect(listed.json()).toMatchObject({ data: [{ id: row!.id }], nextCursor: null });

    const updated = await callTool("update_link", {
      alias: ALIAS,
      newAlias: "mcptest-two",
      expiresAfter: 50,
    });
    expect(updated.result.isError).toBeUndefined();
    expect(updated.json()).toMatchObject({ alias: "mcptest-two", expiresAfter: 50 });

    const analytics = await callTool("get_link_analytics", { alias: "mcptest-two" });
    expect(analytics.json()).toMatchObject({ totalClicks: 0 });

    const qr = await callTool("create_qr_code", { alias: "mcptest-two" });
    expect(qr.json()).toMatchObject({ shortLink: "https://isht.app/mcptest-two" });
    const image = qr.result.content[1]!;
    expect(image).toMatchObject({ type: "image", mimeType: "image/png" });
    expect([...Buffer.from(image.data!, "base64").subarray(1, 4)]).toEqual([0x50, 0x4e, 0x47]);

    const deleted = await callTool("delete_link", { alias: "mcptest-two" });
    expect(deleted.text).toBe("Deleted mcptest-two.");
    expect(await db.select().from(schema.link).where(eq(schema.link.id, row!.id))).toHaveLength(0);

    const missing = await callTool("get_link", { alias: "mcptest-two" });
    expect(missing.result.isError).toBe(true);
    expect(missing.text).toBe("Link not found");
  });

  test("create_qr_code with a url creates the link it encodes", async () => {
    await subscribePro();
    const qr = await callTool("create_qr_code", { url: TARGET_URL });
    expect(qr.result.isError).toBeUndefined();
    const links = await db.select().from(schema.link).where(eq(schema.link.userId, USER_ID));
    expect(links).toHaveLength(1);
    expect(qr.json().shortLink).toBe(`https://isht.app/${links[0]!.alias}`);

    const neither = await callTool("create_qr_code", {});
    expect(neither.result.isError).toBe(true);
    expect(neither.text).toContain("Give a `url` to shorten");
  });

  test("get_account returns the plan, monthly usage and rate limits", async () => {
    await subscribePro();
    await db.update(schema.user).set({ monthlyLinkCount: 7 }).where(eq(schema.user.id, USER_ID));
    const account = await callTool("get_account");
    expect(account.json()).toMatchObject({
      id: USER_ID,
      email: "mcp@example.com",
      plan: "pro",
      usage: { linksThisMonth: 7, linksLimit: 1000 },
      rateLimits: API_RATE_LIMITS.pro,
    });
  });

  test("returns v1 validation and plan errors as tool errors", async () => {
    await subscribePro();
    const badArgs = await callTool("create_link", { alias: "x" });
    expect(badArgs.result.isError).toBe(true);
    expect(badArgs.text).toContain("Invalid arguments");
    expect(badArgs.text).toContain("url");

    const badUrl = await callTool("create_link", { url: "not a url" });
    expect(badUrl.result.isError).toBe(true);
    expect(badUrl.text).toContain("Request body is invalid");

    const noChanges = await callTool("update_link", { alias: "mcptest-none" });
    expect(noChanges.result.isError).toBe(true);
    expect(noChanges.text).toBe("Link not found");

    const unknown = await rpc("tools/call", { name: "nope" });
    expect(unknown.body.error.code).toBe(-32602);
  });
});
