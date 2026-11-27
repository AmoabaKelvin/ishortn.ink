import { CORS_HEADERS, handleMcpPost } from "./server";

// Served at https://ishortn.ink/mcp: the middleware rewrites /mcp to this route on the app host
// only, so /mcp stays a short-link alias on every short-link domain.
export const dynamic = "force-dynamic";

export const POST = handleMcpPost;

// Stateless server: no server-sent event stream to open (GET) and no session to end (DELETE).
function methodNotAllowed() {
  return new Response(null, { status: 405, headers: { ...CORS_HEADERS, Allow: "POST, OPTIONS" } });
}

export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
