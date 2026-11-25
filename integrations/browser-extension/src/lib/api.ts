import type { ErrorBody } from "./errors.ts";

export type Plan = "free" | "pro" | "ultra";

export type Me = {
  email: string;
  plan: Plan;
  linksUsedThisMonth: number;
  linksLimit: number | null;
  domains: Array<{ domain: string; isDefault: boolean }>;
  upgradeUrl: string;
};

export type CreatedLink = {
  shortUrl: string;
  alias: string;
  domain: string;
  url: string;
  createdAt: string;
};

export type RecentLink = { shortUrl: string; url: string; createdAt: string };

export class ApiError extends Error {
  readonly status: number;
  readonly body: ErrorBody;
  readonly retryAfter: string | null;

  constructor(status: number, body: ErrorBody, retryAfter: string | null) {
    super(`iShortn API request failed with status ${status}`);
    this.status = status;
    this.body = body;
    this.retryAfter = retryAfter;
  }
}

type FetchLike = typeof fetch;

export const createApi = (base: string, token: string, fetchImpl: FetchLike = fetch) => {
  const request = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    let response: Response;
    try {
      response = await fetchImpl(`${base}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: "omit",
        cache: "no-store",
      });
    } catch {
      throw new ApiError(0, null, null);
    }
    if (response.status === 204) return undefined as T; // callers of 204 endpoints expect void
    const json: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      throw new ApiError(response.status, json as ErrorBody, response.headers.get("Retry-After"));
    }
    return json as T; // shape defined by the /api/extension contract
  };

  return {
    me: () => request<Me>("GET", "/api/extension/me"),
    createLink: (input: { url: string; alias?: string; domain?: string }) =>
      request<CreatedLink>("POST", "/api/extension/links", input),
    recentLinks: async (limit = 5) =>
      (await request<{ links: RecentLink[] }>("GET", `/api/extension/links?limit=${limit}`)).links ?? [],
    signOut: () => request<void>("DELETE", "/api/extension/session"),
  };
};

export type Api = ReturnType<typeof createApi>;
