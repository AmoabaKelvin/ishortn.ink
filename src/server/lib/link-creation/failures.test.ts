import { describe, expect, test } from "bun:test";

import { TRPCError } from "@trpc/server";

import { classifyLinkCreationError } from "./failures";

describe("classifyLinkCreationError", () => {
  test("treats 4xx TRPCErrors as client-side", () => {
    expect(
      classifyLinkCreationError("validation", new TRPCError({ code: "CONFLICT", message: "x" })),
    ).toEqual({ step: "validation", code: "CONFLICT", serverError: false });
  });

  test("treats 5xx TRPCErrors as server-side", () => {
    expect(
      classifyLinkCreationError("db", new TRPCError({ code: "INTERNAL_SERVER_ERROR" })),
    ).toEqual({ step: "db", code: "INTERNAL_SERVER_ERROR", serverError: true });
  });

  test("uses the driver code from a wrapped database error", () => {
    const cause = Object.assign(new Error("Lock wait timeout"), { code: "ER_LOCK_WAIT_TIMEOUT" });
    expect(classifyLinkCreationError("db", new Error("Failed query", { cause }))).toEqual({
      step: "db",
      code: "ER_LOCK_WAIT_TIMEOUT",
      serverError: true,
    });
  });

  test("maps aborted fetches to TIMEOUT", () => {
    const error = new DOMException("The operation timed out.", "TimeoutError");
    expect(classifyLinkCreationError("safety", error)).toEqual({
      step: "safety",
      code: "TIMEOUT",
      serverError: true,
    });
  });

  test("falls back to INTERNAL_SERVER_ERROR without leaking the message", () => {
    expect(classifyLinkCreationError("db", new Error("https://secret.example failed"))).toEqual({
      step: "db",
      code: "INTERNAL_SERVER_ERROR",
      serverError: true,
    });
  });
});
