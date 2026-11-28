import { describe, expect, test } from "bun:test";

import { buildClientErrorReport, clientErrorReportInput } from "./client-error-report";

describe("client error reports", () => {
  test("carry the message, digest and stacks of the caught error", () => {
    const error = Object.assign(new TypeError("x.map is not a function"), { digest: "123456" });
    const report = clientErrorReportInput.parse(
      buildClientErrorReport("settings:webhooks", error, "/dashboard/settings", "\n at Webhooks"),
    );

    expect(report).toMatchObject({
      boundary: "settings:webhooks",
      path: "/dashboard/settings",
      message: "x.map is not a function",
      digest: "123456",
      componentStack: "\n at Webhooks",
    });
    expect(report.stack).toContain("TypeError");
  });

  test("fall back to the error name when there is no message", () => {
    const report = buildClientErrorReport("dashboard", new RangeError(""), "/dashboard");
    expect(report.message).toBe("RangeError");
    expect(report.digest).toBeUndefined();
  });

  test("clip oversized fields so one report stays one bounded log line", () => {
    const report = clientErrorReportInput.parse({
      boundary: "dashboard",
      path: `/dashboard/${"a".repeat(2000)}`,
      message: "m".repeat(5000),
      stack: "s".repeat(10_000),
    });
    expect(report.path).toHaveLength(512);
    expect(report.message).toHaveLength(1000);
    expect(report.stack).toHaveLength(4000);
  });

  test("reject reports that are not shaped like one", () => {
    expect(clientErrorReportInput.safeParse({ message: 1 }).success).toBe(false);
    expect(clientErrorReportInput.safeParse(null).success).toBe(false);
  });
});
