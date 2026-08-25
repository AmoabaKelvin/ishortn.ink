import { auth } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";

import { DEFAULT_PLATFORM_DOMAIN } from "@/lib/constants/domains";
import { logger } from "@/lib/logger";
import { isIframeable } from "@/lib/utils/is-iframeable";
import { isPublicHttpUrl } from "@/server/lib/ssrf";

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
    // Only the authenticated link editors need this probe. Leaving it open let
    // anyone use the deployment as a fetch proxy.
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json({ error: "Missing required 'url' parameter" }, { status: 400 });
    }

    // Resolves DNS and rejects loopback, private, link-local, and metadata
    // addresses so the probe can't be aimed at internal services.
    if (!(await isPublicHttpUrl(url))) {
      return NextResponse.json(
        { error: "URL must be a publicly reachable http or https address" },
        { status: 400 },
      );
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
