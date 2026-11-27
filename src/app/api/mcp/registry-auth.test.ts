import { describe, expect, test } from "bun:test";

import { getMcpRegistryAuth, MCP_REGISTRY_AUTH } from "./registry-auth";

const get = (headers: Record<string, string>) =>
  getMcpRegistryAuth(new Request("https://ishortn.ink/.well-known/mcp-registry-auth", { headers }));

describe("getMcpRegistryAuth", () => {
  test("serves the registry proof as plain text on the app host", async () => {
    const response = get({ host: "ishortn.ink" });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toStartWith("text/plain");
    expect(await response.text()).toBe(
      "v=MCPv1; k=ed25519; p=k/o+w3+lYHkB1cDCw/UQ+TkpBcEZQ3WeK4nTe64afdA=",
    );
  });

  test("is not served on short-link or custom domains", async () => {
    for (const host of ["isht.app", "acme.isht.app", "go.example.com"]) {
      const response = get({ host });
      expect(response.status).toBe(404);
      expect(await response.text()).not.toContain(MCP_REGISTRY_AUTH);
    }
  });

  test("prefers x-forwarded-host, like link resolution", () => {
    expect(get({ host: "ishortn.ink", "x-forwarded-host": "go.example.com" }).status).toBe(404);
  });
});
