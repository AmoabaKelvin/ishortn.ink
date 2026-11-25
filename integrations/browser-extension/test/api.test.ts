import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ApiError, createApi } from "../src/lib/api.ts";

type Call = { url: string; init: RequestInit | undefined };

const fakeFetch = (respond: (call: Call) => Response | Promise<Response>) => {
  const calls: Call[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(input), init };
    calls.push(call);
    return respond(call);
  }) as typeof fetch; // test double with the subset of fetch the client uses
  return { calls, impl };
};

describe("createApi", () => {
  it("sends the bearer token and JSON body to the base URL", async () => {
    const { calls, impl } = fakeFetch(() =>
      Response.json(
        { shortUrl: "https://ishortn.ink/a", alias: "a", domain: "ishortn.ink", url: "https://x.y/", createdAt: "" },
        { status: 201 },
      ),
    );
    const api = createApi("http://localhost:3000", "secret-token", impl);
    const link = await api.createLink({ url: "https://x.y/" });

    assert.equal(link.alias, "a");
    assert.equal(calls[0]?.url, "http://localhost:3000/api/extension/links");
    assert.equal(calls[0]?.init?.method, "POST");
    const headers = calls[0]?.init?.headers as Record<string, string>; // built as a plain object
    assert.equal(headers.Authorization, "Bearer secret-token");
    assert.equal(calls[0]?.init?.credentials, "omit");
    assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), { url: "https://x.y/" });
  });

  it("raises ApiError with body and Retry-After", async () => {
    const { impl } = fakeFetch(() =>
      Response.json({ error: "Slow down" }, { status: 429, headers: { "Retry-After": "12" } }),
    );
    const api = createApi("https://ishortn.ink", "t", impl);
    await assert.rejects(api.me(), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 429);
      assert.deepEqual(error.body, { error: "Slow down" });
      assert.equal(error.retryAfter, "12");
      return true;
    });
  });

  it("reports network failures as status 0", async () => {
    const { impl } = fakeFetch(() => {
      throw new TypeError("Failed to fetch");
    });
    const api = createApi("https://ishortn.ink", "t", impl);
    await assert.rejects(api.me(), (error: unknown) => error instanceof ApiError && error.status === 0);
  });

  it("handles 204 on sign out and unwraps recent links", async () => {
    const { calls, impl } = fakeFetch((call) =>
      call.init?.method === "DELETE"
        ? new Response(null, { status: 204 })
        : Response.json({ links: [{ shortUrl: "s", url: "u", createdAt: "c" }] }),
    );
    const api = createApi("https://ishortn.ink", "t", impl);
    await api.signOut();
    assert.equal(calls[0]?.url, "https://ishortn.ink/api/extension/session");
    assert.deepEqual(await api.recentLinks(5), [{ shortUrl: "s", url: "u", createdAt: "c" }]);
    assert.equal(calls[1]?.url, "https://ishortn.ink/api/extension/links?limit=5");
  });
});
