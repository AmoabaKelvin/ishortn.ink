import { describe, expect, it } from "bun:test";

import { statusPayloadSchema } from "./parse";

// Takes the raw response body, as `getSystemStatus` does.
const parseBody = (body: string) => {
  const parsed = statusPayloadSchema.safeParse(JSON.parse(body));
  return parsed.success ? parsed.data : null;
};

const openStatus = (status: string) => JSON.stringify({ status });
const betterStack = (state: string) =>
  JSON.stringify({
    data: { id: "1", type: "status_page", attributes: { aggregate_state: state } },
  });
const statuspage = (indicator: string) =>
  JSON.stringify({ page: { id: "x" }, status: { indicator, description: "…" } });

describe("statusPayloadSchema", () => {
  it("reads OpenStatus responses", () => {
    expect(parseBody(openStatus("operational"))).toBe("operational");
    expect(parseBody(openStatus("degraded_performance"))).toBe("degraded");
    expect(parseBody(openStatus("partial_outage"))).toBe("degraded");
    expect(parseBody(openStatus("under_maintenance"))).toBe("degraded");
    expect(parseBody(openStatus("major_outage"))).toBe("outage");
  });

  it("reads Better Stack responses", () => {
    expect(parseBody(betterStack("operational"))).toBe("operational");
    expect(parseBody(betterStack("degraded"))).toBe("degraded");
    expect(parseBody(betterStack("maintenance"))).toBe("degraded");
    expect(parseBody(betterStack("downtime"))).toBe("outage");
  });

  it("reads Statuspage-compatible responses", () => {
    expect(parseBody(statuspage("none"))).toBe("operational");
    expect(parseBody(statuspage("minor"))).toBe("degraded");
    expect(parseBody(statuspage("major"))).toBe("outage");
    expect(parseBody(statuspage("critical"))).toBe("outage");
  });

  it("is case-insensitive", () => {
    expect(parseBody(openStatus("Operational"))).toBe("operational");
  });

  it("returns null for unknown or malformed payloads", () => {
    expect(parseBody("null")).toBeNull();
    expect(parseBody('"operational"')).toBeNull();
    expect(parseBody("{}")).toBeNull();
    expect(parseBody(openStatus("unknown"))).toBeNull();
    expect(parseBody('{"status":1}')).toBeNull();
    expect(parseBody('{"data":{"attributes":{}}}')).toBeNull();
  });
});
