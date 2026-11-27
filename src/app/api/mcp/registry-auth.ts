import { isAppHost } from "@/lib/constants/domains";

// HTTP proof of domain ownership for the official MCP Registry ("mcp-publisher login http"),
// which publishes the server under the ink.ishortn/* namespace. The value is a public key.
export const MCP_REGISTRY_AUTH =
  "v=MCPv1; k=ed25519; p=k/o+w3+lYHkB1cDCw/UQ+TkpBcEZQ3WeK4nTe64afdA=";

// Served by app/.well-known/mcp-registry-auth/route.ts. A route rather than a public/ file:
// static assets are served on every host, and this proof belongs to the app host only, like /mcp.
export function getMcpRegistryAuth(request: Request): Response {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  if (!isAppHost(host)) return new Response("Not Found", { status: 404 });
  return new Response(MCP_REGISTRY_AUTH, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
