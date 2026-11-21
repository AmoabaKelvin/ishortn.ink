// HTTP status for each visitor-facing link state route. Expired and disabled
// links are gone (410); blocked ones, including geo-blocked, are refused (403);
// scheduled ones will work later, so they stay 200.
const LINK_STATE_STATUS = { blocked: 403, expired: 410, scheduled: 200 } as const;

const LINK_STATE_PATH = /^\/(blocked|expired|scheduled)\/\d+$/;

export function getLinkStateStatus(pathname: string): number | null {
  const state = LINK_STATE_PATH.exec(pathname)?.[1];
  if (state !== "blocked" && state !== "expired" && state !== "scheduled") return null;
  return LINK_STATE_STATUS[state];
}

// The state route a short-link redirect points at, or null for any other
// redirect (link destinations, password pages, other hosts).
function getLinkStateRedirect(request: Request, response: Response): URL | null {
  if (response.status < 300 || response.status > 308) return null;
  const location = response.headers.get("location");
  if (!location) return null;
  const requestUrl = new URL(request.url);
  let target: URL;
  try {
    target = new URL(location, requestUrl);
  } catch {
    return null;
  }
  if (target.origin !== requestUrl.origin) return null;
  return getLinkStateStatus(target.pathname) === null ? null : target;
}

/**
 * Next.js pages can't choose their HTTP status, so the worker entry applies it
 * after the app responds:
 * - A short link in a blocked, expired or scheduled state redirects to
 *   /<state>/<id>. That route is rendered in place instead, so the visitor
 *   stays on the short URL and gets the state's status in one round trip.
 * - A state route that rendered (200) gets its state's status. One that
 *   didn't (404: the link isn't in that state) passes through untouched.
 * Everything else, including every successful redirect, is returned as is.
 */
export async function applyLinkStateStatus(
  request: Request,
  response: Response,
  render: (request: Request) => Promise<Response>,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") return response;

  const stateUrl = getLinkStateRedirect(request, response);
  if (stateUrl) {
    // Passing the original request as init keeps its headers and, on Workers,
    // its `cf` geo data, which the geo-block check on /blocked reads.
    const rendered = await render(new Request(stateUrl, request));
    return withStateStatus(rendered, getLinkStateStatus(stateUrl.pathname));
  }

  return withStateStatus(response, getLinkStateStatus(new URL(request.url).pathname));
}

function withStateStatus(response: Response, status: number | null): Response {
  if (status === null || response.status !== 200 || status === 200) return response;
  return new Response(response.body, { status, headers: response.headers });
}
