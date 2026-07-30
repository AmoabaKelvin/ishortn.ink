import { lookup } from "node:dns/promises";
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

/** Reserved IPv4 blocks that must never be reachable from a user-supplied URL. */
function isBlockedIPv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  const [a, b] = parts as [number, number, number, number];

  if (a === 0) return true; // 0.0.0.0/8 "this host"
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 169 && b === 254) return true; // link-local, incl. 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 protocol assignments
  if (a === 192 && b === 168) return true; // private
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast, reserved, broadcast

  return false;
}

/** Expands any IPv6 text form to its eight 16-bit groups. */
function toHextets(address: string): number[] | null {
  const bare = address.toLowerCase().split("%")[0]!;

  // A trailing dotted quad (::ffff:1.2.3.4) becomes two hex groups.
  const dotted = bare.match(/(\d+\.\d+\.\d+\.\d+)$/);
  const head = dotted ? bare.slice(0, -dotted[1]!.length) : bare;
  const tail = dotted
    ? (() => {
        const o = dotted[1]!.split(".").map(Number);
        return [(o[0]! << 8) | o[1]!, (o[2]! << 8) | o[3]!];
      })()
    : [];

  const [left, right] = head.replace(/:$/, ":0").split("::") as [string, string?];
  const parse = (part: string) =>
    part.split(":").filter(Boolean).map((group) => Number.parseInt(group, 16));

  const leading = parse(left);
  const trailing = right === undefined ? tail : [...parse(right), ...tail];
  const groups =
    right === undefined
      ? [...leading, ...tail]
      : [...leading, ...Array(8 - leading.length - trailing.length).fill(0), ...trailing];

  return groups.length === 8 && groups.every(Number.isInteger) ? groups : null;
}

function isBlockedIPv6(address: string): boolean {
  const h = toHextets(address);
  if (!h) return true; // unparseable — refuse rather than guess

  const [first, second] = h as [number, number, ...number[]];

  // ::/128 unspecified and ::1/128 loopback.
  if (h.slice(0, 7).every((group) => group === 0) && h[7]! <= 1) return true;

  // ::ffff:0:0/96 IPv4-mapped and ::/96 IPv4-compatible inherit the IPv4 rules.
  if (h.slice(0, 5).every((group) => group === 0) && (h[5] === 0xffff || h[5] === 0)) {
    const v4 = `${h[6]! >> 8}.${h[6]! & 0xff}.${h[7]! >> 8}.${h[7]! & 0xff}`;
    return isBlockedIPv4(v4);
  }

  if (first >= 0xfe80 && first <= 0xfebf) return true; // fe80::/10 link-local
  if (first >= 0xfc00 && first <= 0xfdff) return true; // fc00::/7 unique-local
  if (first >= 0xff00) return true; // ff00::/8 multicast
  if (first === 0x0100) return true; // 100::/64 discard-only
  if (first === 0x0064 && second === 0xff9b) return true; // 64:ff9b::/96 NAT64 wraps IPv4
  if (first === 0x2002) return true; // 2002::/16 6to4 wraps IPv4
  if (first === 0x2001 && second === 0x0000) return true; // 2001::/32 Teredo

  return false;
}

function isBlockedAddress(address: string): boolean {
  const version = net.isIP(address);
  if (version === 4) return isBlockedIPv4(address);
  if (version === 6) return isBlockedIPv6(address);
  return true; // not an IP literal — refuse rather than guess
}

/**
 * True when `url` is a syntactically valid http(s) URL whose hostname resolves
 * exclusively to public unicast addresses.
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

  // Reject names that only resolve inside the deployment's network. `all: true`
  // so a name with one public and one private record is still refused.
  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    if (!records.length) return false;
    return records.every((record) => !isBlockedAddress(record.address));
  } catch {
    return false;
  }
}

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

    if (response.status < 300 || response.status > 399) return response;

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
