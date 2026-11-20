import { z } from "zod";

import { API_UPGRADE_URL, apiSunsetWarning } from "@/lib/billing/api-access";

import type { ApiAccess } from "@/lib/billing/api-access";

export function apiAccessRevokedResponse(): Response {
  return Response.json(
    { error: "API access requires Pro", upgrade_url: API_UPGRADE_URL },
    { status: 403 },
  );
}

/** Deprecation (RFC 9745) and Sunset (RFC 8594) headers for a key that is being cut off. */
export function apiSunsetHeaders(access: { deprecatedAt: Date; sunsetAt: Date }) {
  return {
    Deprecation: `@${Math.floor(access.deprecatedAt.getTime() / 1000)}`,
    Sunset: access.sunsetAt.toUTCString(),
    Link: `<${API_UPGRADE_URL}>; rel="sunset"`,
  };
}

const jsonObject = z.record(z.string(), z.json());

function parseJsonObject(text: string): z.infer<typeof jsonObject> | null {
  try {
    const parsed = jsonObject.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Marks a response to a key that is being cut off: the sunset headers on every
 * response, plus a `warning` field when the body is a JSON object (plain-text
 * error bodies and arrays carry the headers only).
 */
export async function withApiSunsetNotice(
  response: Response,
  access: ApiAccess,
): Promise<Response> {
  if (access.status !== "sunsetting") return response;

  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(apiSunsetHeaders(access))) {
    headers.set(name, value);
  }

  let body: BodyInit | null = response.body;
  if (headers.get("content-type")?.includes("application/json")) {
    const text = await response.text();
    body = text;
    const parsed = parseJsonObject(text);
    if (parsed) {
      body = JSON.stringify({ ...parsed, warning: apiSunsetWarning(access.sunsetAt) });
    }
    headers.delete("content-length");
  }

  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}
