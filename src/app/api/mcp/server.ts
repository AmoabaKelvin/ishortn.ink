import { z } from "zod";

import { logger } from "@/lib/logger";

import { withApiKey } from "../v1/utils";
import { listTools, McpUnauthorizedError, prepareToolCall, toolArguments } from "./tools";

import type { ToolResult } from "./tools";

const log = logger.child({ component: "mcp" });

// Newest first; an initialize asking for any other version gets the newest.
const LATEST_PROTOCOL_VERSION = "2025-11-25";
export const SUPPORTED_PROTOCOL_VERSIONS = [LATEST_PROTOCOL_VERSION, "2025-06-18", "2025-03-26"];

const SERVER_INFO = { name: "ishortn", title: "iShortn", version: "1.0.0" };

const INSTRUCTIONS =
  "Manage iShortn short links: create, update, list and delete links, read click analytics, make QR codes and check the account's plan and usage. Every tool works in the personal workspace of the API key's owner. Each request counts toward the account's API rate limit.";

// Bearer-token auth, no cookies, so any origin may call it (browser-based MCP clients included).
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Accept, X-Api-Key, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
};

// JSON-RPC 2.0 error codes.
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;
// Server-defined range (-32000 to -32099).
const UNAUTHORIZED = -32001;
const RATE_LIMITED = -32029;

type JsonRpcId = string | number | null;

type InitializeResult = {
  protocolVersion: string;
  capabilities: { tools: { listChanged: boolean } };
  serverInfo: typeof SERVER_INFO;
  instructions: string;
};

type RpcResult =
  | InitializeResult
  | ToolResult
  | { tools: ReturnType<typeof listTools> }
  | Record<string, never>;

type JsonRpcResponse = { jsonrpc: "2.0"; id: JsonRpcId } & (
  | { result: RpcResult }
  | { error: { code: number; message: string } }
);

const requestMessage = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]),
  method: z.string(),
  params: z.json().optional(),
});

// Notifications (no id) get no answer. So would responses, but this server never sends a request
// for a client to answer.
const notificationMessage = z.strictObject({
  jsonrpc: z.literal("2.0"),
  method: z.string(),
  params: z.json().optional(),
});

const initializeParams = z.object({ protocolVersion: z.string().optional() }).catch({});

const toolCallParams = z.object({ name: z.string(), arguments: toolArguments.optional() });

function json(body: JsonRpcResponse, status = 200, headers: HeadersInit = {}) {
  return Response.json(body, { status, headers: { ...CORS_HEADERS, ...headers } });
}

const result = (id: JsonRpcId, value: RpcResult) => json({ jsonrpc: "2.0", id, result: value });

const rpcError = (id: JsonRpcId, code: number, message: string, status = 200) =>
  json({ jsonrpc: "2.0", id, error: { code, message } }, status);

function unauthorized(id: JsonRpcId) {
  return json(
    {
      jsonrpc: "2.0",
      id,
      error: {
        code: UNAUTHORIZED,
        message:
          "Invalid or missing API key. Send an iShortn API key as `Authorization: Bearer <key>`.",
      },
    },
    401,
    { "WWW-Authenticate": 'Bearer realm="iShortn"' },
  );
}

/** The API key from `Authorization: Bearer`, or the v1 `x-api-key` header for clients that prefer it. */
export function readApiKey(request: Request): string | null {
  const bearer = request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1]
    ?.trim();
  return bearer || request.headers.get("x-api-key")?.trim() || null;
}

// Protocol messages other than tool calls get the v1 key check and rate limit without touching
// any data. A plan refusal still lets the client connect and list the tools: the plan error then
// comes back from the first tool call, where the assistant shows it to the user.
const checkKey = withApiKey(async () => new Response(null, { status: 204 }));

async function protocolError(
  apiKey: string,
  origin: string,
  id: JsonRpcId,
): Promise<Response | null> {
  const response = await checkKey(
    new Request(new URL("/api/v1/me", origin), { headers: { "x-api-key": apiKey } }),
  );
  if (response.status === 401) return unauthorized(id);
  if (response.status === 429) {
    const message = z
      .object({ error: z.object({ message: z.string() }) })
      .safeParse(await response.json().catch(() => null));
    return rpcError(
      id,
      RATE_LIMITED,
      message.success ? message.data.error.message : "Rate limit exceeded",
      429,
    );
  }
  return null;
}

function negotiateVersion(requested: string | undefined) {
  return requested && SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
    ? requested
    : LATEST_PROTOCOL_VERSION;
}

/**
 * The MCP streamable HTTP transport, stateless: every POST carries one JSON-RPC message and gets
 * a JSON answer (no sessions, no server-sent events), which is all a tools-only server needs and
 * keeps each request independent on Workers.
 */
export async function handleMcpPost(request: Request): Promise<Response> {
  const apiKey = readApiKey(request);
  if (!apiKey) return unauthorized(null);
  const origin = new URL(request.url).origin;

  let body;
  try {
    body = z.json().parse(await request.json());
  } catch {
    return rpcError(null, PARSE_ERROR, "Request body must be valid JSON", 400);
  }

  const message = requestMessage.safeParse(body);
  if (!message.success) {
    if (notificationMessage.safeParse(body).success) {
      return new Response(null, { status: 202, headers: CORS_HEADERS });
    }
    return rpcError(null, INVALID_REQUEST, "Expected a single JSON-RPC 2.0 message", 400);
  }
  const { id, method, params } = message.data;

  try {
    if (method === "tools/call") {
      const call = toolCallParams.safeParse(params);
      const prepared = call.success ? prepareToolCall(call.data.name, call.data.arguments) : null;
      if (prepared && "run" in prepared) return result(id, await prepared.run({ apiKey, origin }));
      // A rejected call never reaches the v1 API, so check the key here: a bad key gets the 401,
      // not an argument error.
      const refused = await protocolError(apiKey, origin, id);
      if (refused) return refused;
      if (!call.success) return rpcError(id, INVALID_PARAMS, "tools/call needs a tool `name`");
      if (!prepared) return rpcError(id, INVALID_PARAMS, `Unknown tool: ${call.data.name}`);
      return result(id, prepared.invalid);
    }

    const refused = await protocolError(apiKey, origin, id);
    if (refused) return refused;

    switch (method) {
      case "initialize":
        return result(id, {
          protocolVersion: negotiateVersion(initializeParams.parse(params).protocolVersion),
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        });
      case "ping":
        return result(id, {});
      case "tools/list":
        return result(id, { tools: listTools() });
      default:
        return rpcError(id, METHOD_NOT_FOUND, `Method not found: ${method}`);
    }
  } catch (error) {
    if (error instanceof McpUnauthorizedError) return unauthorized(id);
    log.error({ err: error, method }, "mcp request failed");
    return rpcError(id, INTERNAL_ERROR, "An unexpected error occurred");
  }
}
