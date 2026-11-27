import { describe, expect, test } from "bun:test";

import { webhookUrlError } from "./url";

// Resolver stand-in so no test touches the network.
const records = new Map([
  ["hooks.example.com", ["93.184.216.34"]],
  ["internal.example.com", ["10.0.0.7"]],
  ["home.example.com", ["192.168.1.20"]],
  ["loop.example.com", ["127.0.0.1"]],
  ["metadata.example.com", ["169.254.169.254"]],
  ["v6loop.example.com", ["::1"]],
  ["mixed.example.com", ["93.184.216.34", "10.1.2.3"]],
]);
const resolve = async (hostname: string) => records.get(hostname) ?? [];

describe("webhookUrlError", () => {
  test("accepts a public https URL", async () => {
    expect(await webhookUrlError("https://hooks.example.com/ishortn", resolve)).toBeNull();
    expect(await webhookUrlError("https://93.184.216.34:8443/hook", resolve)).toBeNull();
  });

  test("rejects non-https and malformed URLs", async () => {
    for (const url of ["http://hooks.example.com/", "ftp://hooks.example.com/", "nope", ""]) {
      expect([url, await webhookUrlError(url, resolve)]).not.toEqual([url, null]);
    }
    expect(await webhookUrlError("http://hooks.example.com/", resolve)).toBe(
      "Webhook URLs must start with https://",
    );
  });

  test("rejects private, loopback and link-local IP literals", async () => {
    for (const url of [
      "https://127.0.0.1/",
      "https://10.0.0.1/",
      "https://10.255.1.2/",
      "https://192.168.0.10/",
      "https://169.254.169.254/latest/meta-data",
      "https://[::1]/",
      "https://[fe80::1]/",
      "https://[::ffff:127.0.0.1]/",
    ]) {
      expect([url, await webhookUrlError(url, resolve)]).toEqual([
        url,
        "Webhook URLs can't point to private, loopback or link-local addresses",
      ]);
    }
  });

  test("rejects hostnames that resolve to private addresses", async () => {
    for (const host of [
      "internal.example.com",
      "home.example.com",
      "loop.example.com",
      "metadata.example.com",
      "v6loop.example.com",
      "mixed.example.com",
    ]) {
      expect([host, await webhookUrlError(`https://${host}/hook`, resolve)]).toEqual([
        host,
        "Webhook URLs can't point to private, loopback or link-local addresses",
      ]);
    }
  });

  test("rejects hostnames that don't resolve and URLs with credentials", async () => {
    expect(await webhookUrlError("https://nowhere.example.com/", resolve)).toBe(
      "We couldn't find this hostname. Check the URL and try again.",
    );
    expect(await webhookUrlError("https://user:pass@hooks.example.com/", resolve)).toBe(
      "Remove the username and password from the URL",
    );
  });
});
