import { type NextRequest, NextResponse } from "next/server";

import { DEFAULT_PLATFORM_DOMAIN } from "@/lib/constants/domains";
import { logger } from "@/lib/logger";
import { isIframeable } from "@/lib/utils/is-iframeable";

const log = logger.child({ component: "api.iframeable" });

export const dynamic = "force-dynamic";

/**
 * API endpoint to check if a URL can be embedded in an iframe.
 * Used by the frontend when users enable link cloaking.
 *
 * GET /api/links/iframeable?url=<encoded_url>
 *
 * Returns: { iframeable: boolean }
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json({ error: "Missing required 'url' parameter" }, { status: 400 });
    }

    // Validate URL format
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return NextResponse.json(
          { error: "Invalid URL protocol. Only http and https are supported." },
          { status: 400 },
        );
      }
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    // Get the request domain (the domain that will be embedding the iframe)
    const requestDomain =
      request.headers.get("x-forwarded-host") ??
      request.headers.get("host") ??
      DEFAULT_PLATFORM_DOMAIN;

    const iframeable = await isIframeable({
      url,
      requestDomain,
    });

    return NextResponse.json({ iframeable });
  } catch (error) {
    log.error({ err: error }, "iframe compatibility check failed");
    return NextResponse.json({ error: "Failed to check iframe compatibility" }, { status: 500 });
  }
}
