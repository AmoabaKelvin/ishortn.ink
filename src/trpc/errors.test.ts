import { describe, expect, it } from "bun:test";

import { TRPCClientError } from "@trpc/client";
import { TRPCError } from "@trpc/server";

import { isNotFoundError } from "./errors";

describe("isNotFoundError", () => {
  it("matches NOT_FOUND wrapped by the server api client", () => {
    const wrapped = TRPCClientError.from(
      new TRPCError({ code: "NOT_FOUND", message: "Link not found" }),
    );
    expect(wrapped).toBeInstanceOf(TRPCClientError);
    expect(isNotFoundError(wrapped)).toBe(true);
  });

  it("matches a bare NOT_FOUND TRPCError", () => {
    expect(isNotFoundError(new TRPCError({ code: "NOT_FOUND" }))).toBe(true);
  });

  it("ignores other codes and non-tRPC errors", () => {
    expect(isNotFoundError(TRPCClientError.from(new TRPCError({ code: "UNAUTHORIZED" })))).toBe(
      false,
    );
    expect(isNotFoundError(new Error("NOT_FOUND"))).toBe(false);
    expect(isNotFoundError(undefined)).toBe(false);
  });
});
