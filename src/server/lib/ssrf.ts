import { resolve4, resolve6 } from "node:dns/promises";
import net from "node:net";

/**
 * Guards outbound fetches whose URL comes from a request or from stored user
 * input. Without this, an attacker points the deployment at loopback, RFC1918
 * ranges, or the cloud metadata endpoint and reads the result — or the timing —
 * back out of the response.
 *
 * Only http/https are allowed, and every resolved address must be a public
 * unicast address. Redirects are checked too, so a public URL cannot bounce to
 * an internal one.
 */

/**
 * Reserved ranges that must never be reachable from a user-supplied URL.
 *
 * `net.BlockList` does the address parsing so we don't. That matters: a
 * resolver can hand back an IPv4-mapped address in either textual form
 * (`::ffff:127.0.0.1` or `::ffff:7f00:1`), and BlockList matches both against
 * the IPv4 rules below. Hand-rolled hextet parsing got this wrong.
 */
const BLOCKED = new net.BlockList();

// IPv4
BLOCKED.addSubnet("0.0.0.0", 8, "ipv4"); // "this host on this network"
BLOCKED.addSubnet("10.0.0.0", 8, "ipv4"); // private
BLOCKED.addSubnet("100.64.0.0", 10, "ipv4"); // CGNAT
BLOCKED.addSubnet("127.0.0.0", 8, "ipv4"); // loopback
BLOCKED.addSubnet("169.254.0.0", 16, "ipv4"); // link-local, incl. cloud metadata
BLOCKED.addSubnet("172.16.0.0", 12, "ipv4"); // private
BLOCKED.addSubnet("192.0.0.0", 24, "ipv4"); // IETF protocol assignments
BLOCKED.addSubnet("192.0.2.0", 24, "ipv4"); // documentation (TEST-NET-1)
BLOCKED.addSubnet("192.168.0.0", 16, "ipv4"); // private
BLOCKED.addSubnet("198.18.0.0", 15, "ipv4"); // benchmarking
BLOCKED.addSubnet("198.51.100.0", 24, "ipv4"); // documentation (TEST-NET-2)
BLOCKED.addSubnet("203.0.113.0", 24, "ipv4"); // documentation (TEST-NET-3)
BLOCKED.addSubnet("224.0.0.0", 4, "ipv4"); // multicast
BLOCKED.addSubnet("240.0.0.0", 4, "ipv4"); // reserved, broadcast

// IPv6
BLOCKED.addSubnet("::", 96, "ipv6"); // unspecified, loopback, IPv4-compatible
BLOCKED.addSubnet("64:ff9b::", 96, "ipv6"); // NAT64, wraps IPv4
BLOCKED.addSubnet("100::", 64, "ipv6"); // discard-only
BLOCKED.addSubnet("2001::", 32, "ipv6"); // Teredo
BLOCKED.addSubnet("2001:2::", 48, "ipv6"); // benchmarking
BLOCKED.addSubnet("2001:db8::", 32, "ipv6"); // documentation
BLOCKED.addSubnet("3fff::", 20, "ipv6"); // documentation
BLOCKED.addSubnet("2002::", 16, "ipv6"); // 6to4, wraps IPv4
BLOCKED.addSubnet("fc00::", 7, "ipv6"); // unique-local
BLOCKED.addSubnet("fe80::", 10, "ipv6"); // link-local
BLOCKED.addSubnet("ff00::", 8, "ipv6"); // multicast

/**
 * True when `address` is an IP literal we refuse to connect to. Anything that
 * is not a recognisable IP is refused as well, rather than guessed at.
 */
export function isBlockedAddress(address: string): boolean {
  const bare = address.split("%")[0] ?? ""; // drop any zone index
  const version = net.isIP(bare);
  if (version === 0) return true;

  return BLOCKED.check(bare, version === 4 ? "ipv4" : "ipv6");
}

/**
 * True when `url` is a syntactically valid http(s) URL whose hostname resolves
 * exclusively to public unicast addresses.
 *
 * Note: this resolves the name, and the connection resolves it again. A host
 * with an attacker-controlled, very short TTL can therefore still rebind
 * between the two. Closing that needs the connection pinned to the address
 * validated here, which Node's global fetch has no hook for.
 */
export async function isPublicHttpUrl(url: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

  // Strip the brackets Node keeps on IPv6 literals.
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  if (!hostname) return false;

  if (net.isIP(hostname)) return !isBlockedAddress(hostname);

  // Reject names that resolve anywhere inside the deployment's network: every
  // A and AAAA record must be public. resolve4/resolve6 rather than lookup —
  // Workers implements the resolver calls (over DoH) but not getaddrinfo.
  const [v4, v6] = await Promise.allSettled([resolve4(hostname), resolve6(hostname)]);
  const addresses = [v4, v6].flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  if (!addresses.length) return false;
  return addresses.every((address) => !isBlockedAddress(address));
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

type SafeFetchOptions = {
  /** Max redirect hops to follow; each hop is re-validated. */
  maxRedirects?: number;
} & Omit<RequestInit, "redirect">;

/**
 * fetch() that refuses internal destinations, including across redirects.
 * Returns null when the target (or any hop) is not a public http(s) address.
 */
export async function safeFetch(
  url: string,
  { maxRedirects = 3, ...init }: SafeFetchOptions = {},
): Promise<Response | null> {
  let current = url;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (!(await isPublicHttpUrl(current))) return null;

    // "manual" keeps us in control of each hop so redirect targets get the same
    // address check as the original URL.
    const response = await fetch(current, { ...init, redirect: "manual" });

    if (!REDIRECT_STATUSES.has(response.status)) return response;

    const location = response.headers.get("location");
    if (!location) return response;

    try {
      current = new URL(location, current).toString();
    } catch {
      return null;
    }
  }

  return null;
}
