import { NextRequest } from "next/server";
import { z } from "zod";

import { API_UPGRADE_URL } from "@/lib/billing/api-access";
import { generateQRCodePng } from "@/lib/qr-generator/png";

import { GET as linkAnalyticsRoute } from "../v1/analytics/[alias]/route";
import {
  DELETE as deleteLinkRoute,
  GET as getLinkRoute,
  PATCH as updateLinkRoute,
} from "../v1/links/[alias]/route";
import { POST as createLinkRoute, GET as listLinksRoute } from "../v1/links/route";
import { GET as meRoute } from "../v1/me/route";

/** A tools/call `arguments` object, as JSON. */
export const toolArguments = z.record(z.string(), z.json());
export type ToolArguments = z.infer<typeof toolArguments>;

/** Who is calling: the v1 API key from the MCP request and the origin it came in on. */
export type McpCaller = { apiKey: string; origin: string };

export type ToolContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

export type ToolResult = { content: ToolContent[]; isError?: boolean };

/** The key was rejected by v1: the MCP request answers with HTTP 401 instead of a tool result. */
export class McpUnauthorizedError extends Error {
  constructor() {
    super("Invalid or missing API key");
  }
}

export const API_PLAN_MESSAGE = `The iShortn API and MCP server need a Pro or Ultra plan. Upgrade at ${API_UPGRADE_URL}`;

// Every tool goes through the v1 route handlers in-process, so each call gets the API's key
// check, plan access, rate limit, validation and response shape, and the tools can't drift
// from the documented API.
function v1Request(
  caller: McpCaller,
  method: string,
  path: string,
  { query, body }: { query?: Record<string, string | number | undefined>; body?: unknown } = {},
) {
  const url = new URL(`/api/v1${path}`, caller.origin);
  for (const [name, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") url.searchParams.set(name, String(value));
  }
  return new NextRequest(url, {
    method,
    headers: { "x-api-key": caller.apiKey, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const aliasParams = (alias: string) => ({ params: Promise.resolve({ alias }) });

type V1Result =
  | { ok: true; data: z.infer<ReturnType<typeof z.json>> }
  | { ok: false; message: string };

// The plan-gated 403 has its own body shape (see apiAccessRevokedResponse); every other v1
// error is `{ error: { code, message, details } }`.
const planErrorBody = z.object({ error: z.string(), upgrade_url: z.string() });
const v1ErrorBody = z.object({
  error: z.object({
    message: z.string(),
    details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  }),
});

async function readV1Response(response: Response): Promise<V1Result> {
  if (response.status === 401) throw new McpUnauthorizedError();
  if (response.status === 204) return { ok: true, data: null };

  const body = z.json().safeParse(await response.json().catch(() => null));
  const data = body.success ? body.data : null;
  if (response.ok) return { ok: true, data };

  if (planErrorBody.safeParse(data).success) return { ok: false, message: API_PLAN_MESSAGE };
  const parsed = v1ErrorBody.safeParse(data);
  if (!parsed.success) return { ok: false, message: `Request failed (HTTP ${response.status})` };
  const { message, details = [] } = parsed.data.error;
  const lines = details.map((d) => `- ${d.path || "input"}: ${d.message}`);
  return { ok: false, message: [message, ...lines].join("\n") };
}

const text = (value: string): ToolContent => ({ type: "text", text: value });

export const toolError = (message: string): ToolResult => ({
  content: [text(message)],
  isError: true,
});

function jsonResult(result: V1Result): ToolResult {
  if (!result.ok) return toolError(result.message);
  return { content: [text(JSON.stringify(result.data, null, 2))] };
}

const aliasField = z
  .string()
  .min(1)
  .describe("The link's alias: the part after the domain, e.g. `launch` in isht.app/launch.");
const domainField = z
  .string()
  .describe(
    "The short-link domain, e.g. isht.app or one of the account's active custom domains. Defaults to the account's default domain.",
  );
const dateTimeField = (what: string) =>
  z.string().describe(`${what}, as an ISO 8601 date-time with an offset (2026-12-31T23:59:00Z).`);
const utmField = z
  .object({
    utm_source: z.string().optional(),
    utm_medium: z.string().optional(),
    utm_campaign: z.string().optional(),
    utm_term: z.string().optional(),
    utm_content: z.string().optional(),
  })
  .describe("UTM tags the redirect appends to the destination URL.");

const linkInput = z.object({ alias: aliasField, domain: domainField.optional() });

const createLinkInput = z.object({
  url: z.string().min(1).describe("The destination URL the short link redirects to."),
  alias: z
    .string()
    .optional()
    .describe("A custom alias (letters, digits, - and _). Random when left out."),
  domain: domainField.optional(),
  expiresAt: dateTimeField("When the link stops redirecting").optional(),
  activatesAt: dateTimeField("When the link starts redirecting").optional(),
  expiresAfter: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Stop redirecting after this many clicks."),
  password: z.string().optional().describe("Ask visitors for this password before redirecting."),
  utmParams: utmField.optional(),
});

async function createLink(caller: McpCaller, input: z.infer<typeof createLinkInput>) {
  return readV1Response(
    await createLinkRoute(v1Request(caller, "POST", "/links", { body: input })),
  );
}

async function getLink(caller: McpCaller, { alias, domain }: z.infer<typeof linkInput>) {
  const request = v1Request(caller, "GET", `/links/${encodeURIComponent(alias)}`, {
    query: { domain },
  });
  return readV1Response(await getLinkRoute(request, aliasParams(alias)));
}

const createQrCodeInput = createLinkInput
  .pick({ alias: true, domain: true })
  .extend({
    url: z
      .string()
      .optional()
      .describe(
        "Shorten this URL and make a QR code for the new link. Leave out to use the existing link given by `alias`.",
      ),
  })
  .refine((input) => input.url || input.alias, {
    message: "Give a `url` to shorten, or the `alias` of an existing link",
  });

type Annotations = { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean };

type Tool = {
  name: string;
  title: string;
  description: string;
  input: z.ZodType;
  annotations: Annotations;
  /** Validates `args` against `input`, then runs the tool. Invalid arguments are a tool error. */
  run: (caller: McpCaller, args: ToolArguments | undefined) => Promise<ToolResult>;
};

function formatIssues(heading: string, error: z.ZodError) {
  const issues = error.issues.map((i) => `- ${i.path.join(".") || "input"}: ${i.message}`);
  return [heading, ...issues].join("\n");
}

function defineTool<Input>({
  call,
  ...tool
}: Omit<Tool, "run"> & {
  input: z.ZodType<Input>;
  call: (caller: McpCaller, input: Input) => Promise<ToolResult>;
}): Tool {
  return {
    ...tool,
    run: async (caller, args) => {
      const parsed = tool.input.safeParse(args ?? {});
      if (!parsed.success) return toolError(formatIssues("Invalid arguments", parsed.error));
      return call(caller, parsed.data);
    },
  };
}

export const TOOLS: Tool[] = [
  defineTool({
    name: "create_link",
    title: "Create short link",
    description:
      "Create a short link in the account's personal workspace. Returns the link, including `shortLink`. Counts toward the plan's monthly link limit.",
    input: createLinkInput,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    call: async (caller, input) => jsonResult(await createLink(caller, input)),
  }),
  defineTool({
    name: "update_link",
    title: "Update short link",
    description:
      "Change a link's destination, alias, domain, schedule or click limit. Renamed or moved links keep redirecting from their old address. Pass null to clear expiresAt, activatesAt or expiresAfter.",
    input: linkInput.extend({
      url: z.string().optional().describe("The new destination URL."),
      newAlias: z.string().optional().describe("Rename the link to this alias."),
      newDomain: z.string().optional().describe("Move the link to this domain."),
      expiresAt: dateTimeField("When the link stops redirecting").nullable().optional(),
      activatesAt: dateTimeField("When the link starts redirecting").nullable().optional(),
      expiresAfter: z
        .number()
        .int()
        .positive()
        .nullable()
        .optional()
        .describe("Stop redirecting after this many clicks."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    call: async (caller, { alias, domain, newAlias, newDomain, ...changes }) => {
      const request = v1Request(caller, "PATCH", `/links/${encodeURIComponent(alias)}`, {
        query: { domain },
        body: { ...changes, alias: newAlias, domain: newDomain },
      });
      return jsonResult(await readV1Response(await updateLinkRoute(request, aliasParams(alias))));
    },
  }),
  defineTool({
    name: "get_link",
    title: "Get short link",
    description: "Look up one short link by its alias and domain.",
    input: linkInput,
    annotations: { readOnlyHint: true },
    call: async (caller, input) => jsonResult(await getLink(caller, input)),
  }),
  defineTool({
    name: "list_links",
    title: "List short links",
    description:
      "List the personal workspace's short links, newest first. When `nextCursor` is not null, pass it as `cursor` to get the next page.",
    input: z.object({
      limit: z.number().int().min(1).max(100).optional().describe("Links per page, 1-100 (25)."),
      cursor: z.string().optional().describe("The `nextCursor` of the previous page."),
      domain: z.string().optional().describe("Only links on this domain."),
    }),
    annotations: { readOnlyHint: true },
    call: async (caller, query) =>
      jsonResult(
        await readV1Response(await listLinksRoute(v1Request(caller, "GET", "/links", { query }))),
      ),
  }),
  defineTool({
    name: "delete_link",
    title: "Delete short link",
    description:
      "Delete a short link and its analytics. It stops redirecting straight away. This can't be undone.",
    input: linkInput,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    call: async (caller, { alias, domain }) => {
      const request = v1Request(caller, "DELETE", `/links/${encodeURIComponent(alias)}`, {
        query: { domain },
      });
      const result = await readV1Response(await deleteLinkRoute(request, aliasParams(alias)));
      if (!result.ok) return toolError(result.message);
      return { content: [text(`Deleted ${domain ? `${domain}/` : ""}${alias}.`)] };
    },
  }),
  defineTool({
    name: "get_link_analytics",
    title: "Get link analytics",
    description:
      "Click analytics for one link: total and unique clicks, and clicks by country, city, device, browser, OS and referrer, over the plan's analytics window.",
    input: linkInput,
    annotations: { readOnlyHint: true },
    call: async (caller, { alias, domain }) => {
      const request = v1Request(caller, "GET", `/analytics/${encodeURIComponent(alias)}`, {
        query: { domain },
      });
      return jsonResult(
        await readV1Response(await linkAnalyticsRoute(request, aliasParams(alias))),
      );
    },
  }),
  defineTool({
    name: "create_qr_code",
    title: "Create QR code",
    description:
      "Make a QR code (PNG) that opens a short link, so scans are counted in the link's analytics. Give `url` to create a new short link for it (optionally with `alias` and `domain`), or `alias` alone for an existing link.",
    input: createQrCodeInput,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    call: async (caller, { url, alias, domain }) => {
      const result = url
        ? await createLink(caller, { url, alias, domain })
        : await getLink(caller, { alias: alias ?? "", domain });
      if (!result.ok) return toolError(result.message);

      const shortLink = z.object({ shortLink: z.string() }).safeParse(result.data);
      if (!shortLink.success) return toolError("The link has no short URL to encode.");
      const png = generateQRCodePng(shortLink.data.shortLink);
      return {
        content: [
          text(JSON.stringify(result.data, null, 2)),
          { type: "image", data: Buffer.from(png).toString("base64"), mimeType: "image/png" },
        ],
      };
    },
  }),
  defineTool({
    name: "get_account",
    title: "Get account",
    description:
      "The account that owns the API key: email, plan, default domain, links created this month against the plan's monthly limit (null means unlimited), and API rate limits.",
    input: z.object({}),
    annotations: { readOnlyHint: true },
    call: async (caller) =>
      jsonResult(await readV1Response(await meRoute(v1Request(caller, "GET", "/me")))),
  }),
];

/** The `tools/list` entries: each tool's metadata with its input as JSON Schema. */
export function listTools() {
  return TOOLS.map(({ name, title, description, input, annotations }) => {
    const { $schema: _, ...inputSchema } = z.toJSONSchema(input, { io: "input" });
    return { name, title, description, inputSchema, annotations: { title, ...annotations } };
  });
}

/** Runs a tool; null when there is no tool by that name. */
export async function callTool(
  caller: McpCaller,
  name: string,
  args: ToolArguments | undefined,
): Promise<ToolResult | null> {
  const tool = TOOLS.find((candidate) => candidate.name === name);
  return tool ? tool.run(caller, args) : null;
}
