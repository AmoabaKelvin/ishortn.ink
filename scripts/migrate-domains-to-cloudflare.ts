import "dotenv/config";

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import { customDomain } from "../src/server/db/schema";

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";
const DUPLICATE_HOSTNAME_ERROR_CODE = 1406;

type CloudflareCustomHostname = {
  id: string;
  hostname: string;
  status: string;
  ssl?: { status: string } | null;
};

type CloudflareApiResponse<T> = {
  success: boolean;
  errors?: { code: number; message: string }[];
  result: T | null;
};

type MigrationRow = {
  domain: string;
  result: "created" | "already exists" | "failed";
  status: string;
  ssl: string;
  error: string;
};

const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const zoneId = process.env.CLOUDFLARE_SAAS_ZONE_ID;
const databaseUrl = process.env.DATABASE_URL;

if (!apiToken || !zoneId || !databaseUrl) {
  console.error(
    "Missing required environment variables: CLOUDFLARE_API_TOKEN, CLOUDFLARE_SAAS_ZONE_ID, DATABASE_URL",
  );
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${apiToken}`,
  "Content-Type": "application/json",
};

async function createCustomHostname(domain: string) {
  const response = await fetch(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/custom_hostnames`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      hostname: domain,
      ssl: {
        method: "http",
        type: "dv",
        settings: { min_tls_version: "1.2" },
      },
    }),
  });

  return (await response.json()) as CloudflareApiResponse<CloudflareCustomHostname>;
}

async function getCustomHostname(domain: string) {
  const response = await fetch(
    `${CLOUDFLARE_API_BASE}/zones/${zoneId}/custom_hostnames?hostname=${encodeURIComponent(domain)}`,
    { method: "GET", headers },
  );

  const data = (await response.json()) as CloudflareApiResponse<CloudflareCustomHostname[]>;

  if (!data.success || !data.result) {
    return null;
  }

  return data.result[0] ?? null;
}

async function migrateDomain(domain: string): Promise<MigrationRow> {
  try {
    const data = await createCustomHostname(domain);

    if (data.success && data.result) {
      return {
        domain,
        result: "created",
        status: data.result.status,
        ssl: data.result.ssl?.status ?? "unknown",
        error: "",
      };
    }

    if (data.errors?.some((error) => error.code === DUPLICATE_HOSTNAME_ERROR_CODE)) {
      const existing = await getCustomHostname(domain);
      return {
        domain,
        result: "already exists",
        status: existing?.status ?? "unknown",
        ssl: existing?.ssl?.status ?? "unknown",
        error: "",
      };
    }

    return {
      domain,
      result: "failed",
      status: "-",
      ssl: "-",
      error:
        data.errors?.map((error) => `${error.code}: ${error.message}`).join("; ") ??
        "unknown error",
    };
  } catch (error) {
    return {
      domain,
      result: "failed",
      status: "-",
      ssl: "-",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

void (async () => {
  const connection = await mysql.createConnection(databaseUrl);
  let failed = 0;

  try {
    const db = drizzle(connection);

    const rows = await db.select({ domain: customDomain.domain }).from(customDomain);
    const domains = [...new Set(rows.map((row) => row.domain).filter((d): d is string => !!d))];

    console.log(`Migrating ${domains.length} unique domains to Cloudflare custom hostnames...`);

    const results: MigrationRow[] = [];
    for (const domain of domains) {
      results.push(await migrateDomain(domain));
    }

    console.table(results);

    failed = results.filter((row) => row.result === "failed").length;
    console.log(
      `Done: ${results.filter((row) => row.result === "created").length} created, ` +
        `${results.filter((row) => row.result === "already exists").length} already existed, ` +
        `${failed} failed`,
    );
  } finally {
    await connection.end();
  }

  if (failed > 0) {
    process.exit(1);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
