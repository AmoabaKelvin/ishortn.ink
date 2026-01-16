import { NextResponse } from "next/server";

import { cleanupDeletedAccounts } from "@/server/api/routers/account-transfer/account-cleanup.service";

/**
 * Cron job endpoint to clean up soft-deleted accounts that have passed the grace period.
 *
 * This endpoint requires API key authentication via the CRON_SECRET environment variable.
 * Vercel Cron automatically sends GET requests with the Authorization header.
 *
 * Schedule: 0 1 * * * (daily at 1 AM) - configured in vercel.json
 *
 * Environment variable required:
 * - CRON_SECRET: A secure random string used to authenticate cron requests
 *
 * Usage:
 * GET /api/cron/cleanup-accounts
 * Headers: { "Authorization": "Bearer <CRON_SECRET>" }
 */

function validateApiKey(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET environment variable is not set");
    return false;
  }

  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    return false;
  }

  // Support both "Bearer <token>" and just "<token>"
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  // Use timing-safe comparison to prevent timing attacks
  if (token.length !== cronSecret.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ cronSecret.charCodeAt(i);
  }

  return result === 0;
}

/**
 * GET - Run the cleanup job (Vercel Cron sends GET requests)
 */
export async function GET(request: Request) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[Account Cleanup] Starting cleanup job...");
    const startTime = Date.now();

    const result = await cleanupDeletedAccounts();

    const duration = Date.now() - startTime;
    console.log(
      `[Account Cleanup] Completed in ${duration}ms. Deleted ${result.accountsDeleted} accounts.`,
    );

    return NextResponse.json({
      success: true,
      result,
      duration: `${duration}ms`,
    });
  } catch (error) {
    console.error("[Account Cleanup] Error during cleanup:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
