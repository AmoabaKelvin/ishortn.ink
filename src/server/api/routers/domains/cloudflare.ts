import { z } from "zod";

import { env } from "@/env.mjs";

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";

// Cloudflare error code for a custom hostname that already exists on the zone
const DUPLICATE_HOSTNAME_ERROR_CODE = 1406;

const customHostnameSchema = z.object({
  id: z.string(),
  hostname: z.string(),
  status: z.string(),
  ssl: z.object({ status: z.string() }).nullish(),
  ownership_verification: z
    .object({ type: z.string(), name: z.string(), value: z.string() })
    .nullish(),
});

export type CloudflareCustomHostname = z.infer<typeof customHostnameSchema>;

function apiResponseSchema<Result extends z.ZodType>(result: Result) {
  return z.object({
    success: z.boolean(),
    errors: z.array(z.object({ code: z.number(), message: z.string() })).optional(),
    result: result.nullable(),
  });
}

const customHostnameResponseSchema = apiResponseSchema(customHostnameSchema);
const customHostnameListResponseSchema = apiResponseSchema(z.array(customHostnameSchema));

export type CustomHostnameChallenge = {
  type: "TXT" | "A" | "CNAME";
  domain: string;
  value: string;
};

const CLOUDFLARE_API_TIMEOUT_MS = 10_000;

function saasCredentials() {
  const token = env.CLOUDFLARE_API_TOKEN;
  const zoneId = env.CLOUDFLARE_SAAS_ZONE_ID;
  if (!token || !zoneId) {
    throw new Error(
      "Custom domains are not configured: set CLOUDFLARE_API_TOKEN and CLOUDFLARE_SAAS_ZONE_ID.",
    );
  }
  return { token, zoneId };
}

function zoneUrl(path: string) {
  return `${CLOUDFLARE_API_BASE}/zones/${saasCredentials().zoneId}${path}`;
}

function requestHeaders() {
  return {
    Authorization: `Bearer ${saasCredentials().token}`,
    "Content-Type": "application/json",
  };
}

async function cloudflareFetch(url: string, init: RequestInit) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(CLOUDFLARE_API_TIMEOUT_MS) });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error("The domain service took too long to respond. Please try again.");
    }
    throw error;
  }
}

export async function addCustomHostname(domain: string) {
  const response = await cloudflareFetch(zoneUrl("/custom_hostnames"), {
    method: "POST",
    headers: requestHeaders(),
    body: JSON.stringify({
      hostname: domain,
      ssl: {
        method: "http",
        type: "dv",
        settings: { min_tls_version: "1.2" },
      },
    }),
  });

  const data = customHostnameResponseSchema.parse(await response.json());

  if (!data.success || !data.result) {
    if (data.errors?.some((error) => error.code === DUPLICATE_HOSTNAME_ERROR_CODE)) {
      return { alreadyExists: true as const };
    }
    throw new Error("Failed to add domain. Please check the domain name and try again.");
  }

  return {
    alreadyExists: false as const,
    hostname: data.result,
  };
}

export async function getCustomHostname(domain: string) {
  const response = await cloudflareFetch(
    zoneUrl(`/custom_hostnames?hostname=${encodeURIComponent(domain)}`),
    {
      method: "GET",
      headers: requestHeaders(),
    },
  );

  const data = customHostnameListResponseSchema.parse(await response.json());

  // A failed lookup must throw rather than read as "hostname absent" — callers
  // rely on the distinction (fetchError flag, delete refusing to run blind).
  if (!response.ok || !data.success || !data.result) {
    const detail = data.errors?.map((error) => `${error.code}: ${error.message}`).join("; ");
    throw new Error(
      `Cloudflare custom hostname lookup failed: ${detail || `HTTP ${response.status}`}`,
    );
  }

  return data.result[0] ?? null;
}

export async function deleteCustomHostname(domain: string) {
  const hostname = await getCustomHostname(domain);

  if (!hostname) {
    return;
  }

  const response = await cloudflareFetch(zoneUrl(`/custom_hostnames/${hostname.id}`), {
    method: "DELETE",
    headers: requestHeaders(),
  });

  if (!response.ok) {
    throw new Error("Failed to remove the domain. Please try again.");
  }
}

export function mapStatus(hostname: CloudflareCustomHostname): "active" | "pending" {
  return hostname.status === "active" && hostname.ssl?.status === "active" ? "active" : "pending";
}

// An apex customer whose DNS host cannot ALIAS at the root serves through a
// www custom hostname plus an apex redirect instead; an active www hostname
// counts as the apex being migrated.
export async function wwwFallbackActive(domain: string): Promise<boolean> {
  if (domain.split(".").length !== 2) return false;
  try {
    const hostname = await getCustomHostname(`www.${domain}`);
    return hostname !== null && mapStatus(hostname) === "active";
  } catch {
    return false;
  }
}

export function buildVerificationChallenges(
  domain: string,
  hostname?: CloudflareCustomHostname | null,
): CustomHostnameChallenge[] {
  const isApex = domain.split(".").length === 2;
  const target = env.CUSTOM_DOMAIN_CNAME_TARGET;

  const challenges: CustomHostnameChallenge[] = [
    {
      type: "CNAME",
      domain: isApex ? "@" : domain.split(".").slice(0, -2).join("."),
      value: target,
    },
  ];

  const ownership = hostname?.ownership_verification;
  if (ownership?.type === "txt" && ownership.name && ownership.value) {
    // Relative to the registered domain (like the CNAME row), so a subdomain
    // customer creates _cf-custom-hostname.<sub> in their zone, not
    // _cf-custom-hostname at the apex.
    const registered = domain.split(".").slice(-2).join(".");
    challenges.push({
      type: "TXT",
      domain: ownership.name.endsWith(`.${registered}`)
        ? ownership.name.slice(0, -(registered.length + 1))
        : ownership.name,
      value: ownership.value,
    });
  }

  return challenges;
}
