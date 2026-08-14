// Legacy Vercel project-domains API. Custom domains are registered with
// Cloudflare for SaaS (see ./cloudflare.ts); this module only backs the
// dual-run fallback for domains still configured against Vercel.

import { env } from "@/env.mjs";

export interface VercelDomainResponse {
  name: string;
  apexName: string;
  projectId: string;
  redirect?: string | null;
  redirectStatusCode?: number | null;
  gitBranch?: string | null;
  updatedAt?: number;
  createdAt?: number;
  verified: boolean;
  verification?: {
    type: string;
    domain: string;
    value: string;
    reason: string;
  }[];
}

export interface VercelErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export function hasLegacyVercelCredentials() {
  return Boolean(env.PROJECT_ID_VERCEL && env.TEAM_ID_VERCEL && env.AUTH_BEARER_TOKEN);
}

export async function addDomainToVercelProject(domain: string) {
  const response = await fetch(
    `https://api.vercel.com/v9/projects/${env.PROJECT_ID_VERCEL}/domains?teamId=${env.TEAM_ID_VERCEL}`,
    {
      body: `{\n  "name": "${domain}"\n}`,
      headers: {
        Authorization: `Bearer ${env.AUTH_BEARER_TOKEN}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );

  const responseJson = (await response.json()) as unknown;
  const data = responseJson as VercelDomainResponse | VercelErrorResponse;

  if ("error" in data) {
    switch (data.error.code) {
      case "forbidden":
        throw new Error("You don't have permission to add a domain to this project");
      case "domain_taken":
        throw new Error("This domain is already taken by another Vercel project");
      case "domain_already_in_use":
        // Domain is already added to our Vercel project - this is fine for domain sharing
        return { alreadyExists: true as const };
      default:
        throw new Error("Failed to add domain to project");
    }
  }

  return {
    ...data,
    alreadyExists: false as const,
    verificationChallenges:
      data.verification?.map((challenge) => ({
        type: challenge.type,
        domain: challenge.domain,
        value: challenge.value,
      })) ?? [],
  };
}

export async function getDomainFromVercelProject(domain: string) {
  const response = await fetch(
    `https://api.vercel.com/v9/projects/${env.PROJECT_ID_VERCEL}/domains/${domain}?teamId=${env.TEAM_ID_VERCEL}`,
    {
      headers: {
        Authorization: `Bearer ${env.AUTH_BEARER_TOKEN}`,
        "Content-Type": "application/json",
      },
      method: "GET",
    },
  );

  const data = (await response.json()) as VercelDomainResponse | VercelErrorResponse;

  if ("error" in data) {
    return null;
  }

  return data;
}

export async function deleteDomainFromVercelProject(domain: string) {
  if (!hasLegacyVercelCredentials()) {
    return;
  }

  await fetch(
    `https://api.vercel.com/v9/projects/${env.PROJECT_ID_VERCEL}/domains/${domain}?teamId=${env.TEAM_ID_VERCEL}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${env.AUTH_BEARER_TOKEN}`,
      },
    },
  );
}

export async function isDomainActiveOnVercel(domain: string): Promise<boolean> {
  if (!hasLegacyVercelCredentials()) {
    return false;
  }

  try {
    const [domainData, configResponse] = await Promise.all([
      getDomainFromVercelProject(domain),
      fetch(`https://api.vercel.com/v6/domains/${domain}/config?teamId=${env.TEAM_ID_VERCEL}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${env.AUTH_BEARER_TOKEN}`,
          "Content-Type": "application/json",
        },
      }),
    ]);

    if (!domainData || !configResponse.ok) {
      return false;
    }

    const configData = (await configResponse.json()) as { misconfigured: boolean };

    return domainData.verified && !configData.misconfigured;
  } catch {
    return false;
  }
}
