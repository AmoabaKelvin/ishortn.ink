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

export async function addDomainToVercelProject(domain: string) {
  const response = await fetch(
    `https://api.vercel.com/v9/projects/${process.env.PROJECT_ID_VERCEL}/domains?teamId=${process.env.TEAM_ID_VERCEL}`,
    {
      body: `{\n  "name": "${domain}"\n}`,
      headers: {
        Authorization: `Bearer ${process.env.AUTH_BEARER_TOKEN}`,
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
    `https://api.vercel.com/v9/projects/${process.env.PROJECT_ID_VERCEL}/domains/${domain}?teamId=${process.env.TEAM_ID_VERCEL}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.AUTH_BEARER_TOKEN}`,
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
  await fetch(
    `https://api.vercel.com/v9/projects/${process.env.PROJECT_ID_VERCEL}/domains/${domain}?teamId=${process.env.TEAM_ID_VERCEL}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${process.env.AUTH_BEARER_TOKEN}`,
      },
    },
  );
}
