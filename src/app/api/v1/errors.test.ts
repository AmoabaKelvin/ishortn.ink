import { describe, expect, test } from "bun:test";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { apiError, errorResponse, readJsonBody, validationError } from "./errors";

describe("v1 error responses", () => {
  test("apiError uses the documented shape", async () => {
    const response = apiError(404, "not_found", "Link not found");
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({
      error: { code: "not_found", message: "Link not found", details: [] },
    });
  });

  test("validationError lists each failing field", async () => {
    const result = z.object({ url: z.string().url(), n: z.number() }).safeParse({ url: "x" });
    if (result.success) throw new Error("expected a parse failure");
    const response = validationError(result.error);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("validation_failed");
    expect(body.error.details.map((d: { path: string }) => d.path)).toEqual(["url", "n"]);
  });

  test("readJsonBody turns a malformed body into a 400", async () => {
    const bad = await readJsonBody(new Request("http://localhost", { method: "POST", body: "{" }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.response.status).toBe(400);

    const good = await readJsonBody(
      new Request("http://localhost", { method: "POST", body: '{"a":1}' }),
    );
    expect(good).toEqual({ ok: true, body: { a: 1 } });
  });

  test("errorResponse maps thrown errors to statuses without leaking internals", async () => {
    expect(errorResponse(new TRPCError({ code: "FORBIDDEN", message: "Upgrade" })).status).toBe(
      403,
    );
    expect(errorResponse(new Error("Alias already exists")).status).toBe(400);

    const internal = errorResponse(
      new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "db exploded" }),
    );
    expect(internal.status).toBe(500);
    expect((await internal.json()).error.message).toBe("An unexpected error occurred");
  });
});
