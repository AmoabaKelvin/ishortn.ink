import { describe, expect, it } from "bun:test";

import { applyLinkStateStatus, getLinkStateStatus } from "./link-state";

const redirect = (location: string, status = 307) =>
  new Response(null, { status, headers: { location } });

const page = (status = 200, body = "state page") =>
  new Response(body, { status, headers: { "content-type": "text/html" } });

describe("getLinkStateStatus", () => {
  it("maps each state route to its status", () => {
    expect(getLinkStateStatus("/blocked/12")).toBe(403);
    expect(getLinkStateStatus("/expired/12")).toBe(410);
    expect(getLinkStateStatus("/scheduled/12")).toBe(200);
  });

  it("ignores everything else", () => {
    for (const path of ["/", "/abc", "/blocked", "/blocked/abc", "/expired/1/x", "/p/blocked"]) {
      expect(getLinkStateStatus(path)).toBeNull();
    }
  });
});

describe("applyLinkStateStatus", () => {
  const neverRender = () => Promise.reject(new Error("should not render"));

  it("renders a state redirect in place with the state's status", async () => {
    const requested: string[] = [];
    const response = await applyLinkStateStatus(
      new Request("https://isht.app/abc"),
      redirect("/expired/7"),
      async (req) => {
        requested.push(req.url);
        return page();
      },
    );
    expect(requested).toEqual(["https://isht.app/expired/7"]);
    expect(response.status).toBe(410);
    expect(response.headers.get("content-type")).toBe("text/html");
    expect(await response.text()).toBe("state page");
  });

  it("keeps the geo query and the original request headers", async () => {
    let seen: Request | undefined;
    const response = await applyLinkStateStatus(
      new Request("https://go.brand.com/abc", { headers: { "user-agent": "test-agent" } }),
      redirect("https://go.brand.com/blocked/7?geo=3"),
      async (req) => {
        seen = req;
        return page();
      },
    );
    expect(seen?.url).toBe("https://go.brand.com/blocked/7?geo=3");
    expect(seen?.headers.get("user-agent")).toBe("test-agent");
    expect(response.status).toBe(403);
  });

  it("serves a scheduled link in place with 200", async () => {
    const response = await applyLinkStateStatus(
      new Request("https://isht.app/abc"),
      redirect("/scheduled/7"),
      async () => page(),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("state page");
  });

  it("passes a state route's 404 through", async () => {
    const response = await applyLinkStateStatus(
      new Request("https://isht.app/abc"),
      redirect("/blocked/7"),
      async () => page(404, "not found"),
    );
    expect(response.status).toBe(404);
  });

  it("sets the status on direct hits to a state route that rendered", async () => {
    const blocked = await applyLinkStateStatus(
      new Request("https://ishortn.ink/blocked/7"),
      page(),
      neverRender,
    );
    expect(blocked.status).toBe(403);

    const missing = await applyLinkStateStatus(
      new Request("https://ishortn.ink/expired/7"),
      page(404),
      neverRender,
    );
    expect(missing.status).toBe(404);
  });

  it("leaves destination redirects and other responses alone", async () => {
    const destination = redirect("https://example.com/blocked/7");
    expect(
      await applyLinkStateStatus(new Request("https://isht.app/abc"), destination, neverRender),
    ).toBe(destination);

    const password = redirect("/verify-password/7");
    expect(
      await applyLinkStateStatus(new Request("https://isht.app/abc"), password, neverRender),
    ).toBe(password);

    const ok = page();
    expect(await applyLinkStateStatus(new Request("https://isht.app/abc"), ok, neverRender)).toBe(
      ok,
    );

    const post = redirect("/expired/7");
    expect(
      await applyLinkStateStatus(
        new Request("https://isht.app/abc", { method: "POST" }),
        post,
        neverRender,
      ),
    ).toBe(post);
  });
});
