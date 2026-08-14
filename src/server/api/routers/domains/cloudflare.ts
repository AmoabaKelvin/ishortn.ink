import { env } from "@/env.mjs";

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";

// Cloudflare error code for a custom hostname that already exists on the zone
const DUPLICATE_HOSTNAME_ERROR_CODE = 1406;

export interface CloudflareCustomHostname {
  id: string;
  hostname: string;
  status: string;
  ssl?: {
    status: string;
  } | null;
  ownership_verification?: {
    type: string;
    name: string;
    value: string;
  } | null;
}

interface CloudflareApiResponse<T> {
  success: boolean;
  errors?: {
    code: number;
    message: string;
  }[];
  result: T | null;
}

export type CustomHostnameChallenge = {
  type: "TXT" | "A" | "CNAME";
  domain: string;
  value: string;
};

function zoneUrl(path: string) {
  return `${CLOUDFLARE_API_BASE}/zones/${env.CLOUDFLARE_SAAS_ZONE_ID}${path}`;
}

function requestHeaders() {
  return {
    Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
    "Content-Type": "application/json",
  };
}

export async function addCustomHostname(domain: string) {
  const response = await fetch(zoneUrl("/custom_hostnames"), {
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

  const data = (await response.json()) as CloudflareApiResponse<CloudflareCustomHostname>;

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
  const response = await fetch(
    zoneUrl(`/custom_hostnames?hostname=${encodeURIComponent(domain)}`),
    {
      method: "GET",
      headers: requestHeaders(),
    },
  );

  const data = (await response.json()) as CloudflareApiResponse<CloudflareCustomHostname[]>;

  if (!data.success || !data.result) {
    return null;
  }

  return data.result[0] ?? null;
}

export async function deleteCustomHostname(domain: string) {
  const hostname = await getCustomHostname(domain);

  if (!hostname) {
    return;
  }

  const response = await fetch(zoneUrl(`/custom_hostnames/${hostname.id}`), {
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
